import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import {
  publicFiles,
  contentSecurityPolicy,
  securityHeaders,
  resourceHeaders,
} from '../scripts/hosting-rules.mjs';

const config = JSON.parse(await readFile('cloudflare/wrangler.json', 'utf8'));
const site = JSON.parse(await readFile('lib/site-content.json', 'utf8'));
const output = resolve('cloudflare', config.assets.directory);
const files = await publicFiles('dist/client');
const html = await readFile(resolve(output, 'index.html'), 'utf8');
const csp = await contentSecurityPolicy(output);

await test('root Wrangler deploy discovers the built app without running setup or changing dependencies', async () => {
  const pointer = JSON.parse(
    await readFile('.wrangler/deploy/config.json', 'utf8'),
  );
  assert.equal(
    resolve('.wrangler/deploy', pointer.configPath),
    resolve('cloudflare/wrangler.json'),
  );
  const packageBefore = await readFile('package.json', 'utf8');
  const lockBefore = await readFile('package-lock.json', 'utf8');
  const { stdout, stderr } = await promisify(execFile)(
    process.execPath,
    ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run'],
    {
      timeout: 30_000,
      env: {
        ...process.env,
        CI: 'true',
        WRANGLER_SEND_METRICS: 'false',
        WRANGLER_LOG_PATH: resolve(
          tmpdir(),
          `streakfreak-discovery-test-${process.pid}.log`,
        ),
      },
    },
  );
  const log = stdout + stderr;
  assert.ok(log.includes('--dry-run: exiting now.'));
  assert.ok(log.includes('cloudflare/wrangler.json'));
  assert.ok(log.includes('dist/workers'));
  assert.doesNotMatch(log, /Proceed with setup|ERESOLVE/);
  assert.equal(await readFile('package.json', 'utf8'), packageBefore);
  assert.equal(await readFile('package-lock.json', 'utf8'), lockBefore);
});

await test('Workers deploys the complete public build without framework or server metadata', async () => {
  assert.equal(output, resolve('dist/workers'));
  assert.ok(!config.main && !config.d1_databases && !config.r2_buckets);
  assert.equal(config.pages_build_output_dir, undefined);
  assert.deepEqual(config.routes, [
    { pattern: new URL(site.canonical).hostname, custom_domain: true },
  ]);
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, true);
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.assets.html_handling, 'auto-trailing-slash');
  assert.deepEqual(await publicFiles(output), files);
  for (const file of files) {
    assert.deepEqual(
      await readFile(resolve(output, file)),
      await readFile(resolve('dist/client', file)),
      file,
    );
  }
  const names = await readdir(output, { recursive: true });
  assert.ok(
    !names.some((name) =>
      /(^|\/)(\.|_worker\.js|functions|server|vinext-client-entry-manifest\.json)/.test(
        name,
      ),
    ),
  );
  assert.ok(names.includes('404.html'));
  assert.ok(names.includes('_headers'));
  assert.ok(names.includes('_redirects'));
});

const server = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--config',
    'cloudflare/wrangler.json',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    '0',
    '--inspector-port',
    '0',
    '--show-interactive-dev-session=false',
  ],
  {
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      WRANGLER_LOG_PATH: resolve(
        tmpdir(),
        `streakfreak-workers-test-${process.pid}.log`,
      ),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
try {
  const origin = await new Promise((resolveReady, reject) => {
    let log = '';
    const timeout = setTimeout(
      () => reject(new Error(`Workers did not start: ${log}`)),
      30_000,
    );
    const onData = (data) => {
      log = (log + data.toString()).slice(-6000);
      const ready = log.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/);
      if (ready) {
        clearTimeout(timeout);
        resolveReady(ready[1]);
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Workers exited with ${code}: ${log}`));
    });
  });
  const fetchPath = (path, options) =>
    fetch(origin + path, { redirect: 'manual', ...options });

  await test('the real Workers preview applies security, cache, MIME, redirect and 404 rules', async () => {
    const response = await fetchPath('/');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), html);
    for (const [key, value] of Object.entries(securityHeaders(csp))) {
      assert.equal(response.headers.get(key), value, key);
    }
    const resources = [
      'index.rsc',
      'sw.js',
      'manifest.webmanifest',
      'robots.txt',
      'sitemap.xml',
      'llms.txt',
      'icons/icon-512.png',
      'og-image.png',
      files.find((file) => file.endsWith('.woff2')),
      files.find(
        (file) => file.startsWith('_next/static/') && file.endsWith('.js'),
      ),
    ];
    for (const file of resources) {
      const resource = await fetchPath('/' + file);
      assert.equal(resource.status, 200, file);
      for (const [key, value] of Object.entries(resourceHeaders(file))) {
        assert.equal(resource.headers.get(key), value, `${file}: ${key}`);
      }
    }
    for (const alias of ['/index', '/index.html']) {
      const redirect = await fetchPath(alias);
      assert.equal(redirect.status, 308, alias);
      assert.equal(
        new URL(redirect.headers.get('location'), origin).pathname,
        '/',
      );
    }
    for (const path of [
      '/missing',
      '/_headers',
      '/_redirects',
      '/streakfreak',
      '/streakfreak/',
      '/.openai/hosting.json',
      '/vinext-client-entry-manifest.json',
    ]) {
      const missing = await fetchPath(path);
      assert.equal(missing.status, 404, path);
      assert.ok(
        (await missing.text()).includes('name="robots" content="noindex"'),
        path,
      );
    }
    const head = await fetchPath('/', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const etag = response.headers.get('etag');
    assert.ok(etag);
    assert.equal(
      (await fetchPath('/', { headers: { 'If-None-Match': etag } })).status,
      304,
    );
    assert.equal(
      (await fetchPath('/', { method: 'POST', body: 'no server writes' }))
        .status,
      405,
    );
  });

  await test('every service-worker precache request succeeds on Workers without redirects', async () => {
    const context = vm.createContext({ self: { addEventListener() {} } });
    vm.runInContext(await readFile(resolve(output, 'sw.js'), 'utf8'), context);
    const assets = vm.runInContext('ASSETS', context);
    assert.ok(assets.includes('/'));
    assert.ok(!assets.includes('/404.html'));
    assert.ok(!assets.includes('/og-image.png'));
    for (const url of assets) {
      const response = await fetchPath(url);
      assert.equal(
        response.status,
        200,
        `Precache installation would fail: ${url}`,
      );
    }
  });
} finally {
  if (server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
}
