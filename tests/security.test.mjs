import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const entry = base || '/';
const prefix = `${base}/`;
const html = await readFile('dist/client/index.html', 'utf8');
const rules = await readFile('dist/client/_headers', 'utf8');
const deployment = JSON.parse(
  await readFile('.vercel/output/config.json', 'utf8'),
);
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const started = await Promise.race([
  once(server.stdout, 'data').then(([data]) => String(data)),
  once(server, 'exit').then(([code]) => {
    throw new Error(`Preview exited with ${code}`);
  }),
]);
const origin = new URL(started.match(/http:\/\/\S+/)[0]).origin;
const fetchPath = (path, options) =>
  fetch(origin + path, { redirect: 'manual', ...options });
try {
  await test('served CSP permits every exact startup script and blocks arbitrary inline code', async () => {
    const response = await fetchPath(entry);
    assert.equal(response.status, 200);
    const csp = response.headers.get('content-security-policy');
    assert.ok(csp);
    const scriptPolicy = csp
      .split(';')
      .find((directive) => directive.trim().startsWith('script-src '));
    assert.ok(!scriptPolicy.includes('unsafe-inline'));
    assert.ok(!scriptPolicy.includes('unsafe-eval'));
    let checked = 0;
    for (const [, attrs, content] of html.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
    )) {
      if (!content.trim() || attrs.includes('application/ld+json')) continue;
      const digest = (text) =>
        `sha256-${createHash('sha256').update(text).digest('base64')}`;
      assert.ok(
        scriptPolicy.includes(digest(content)),
        'Missing bootstrap hash',
      );
      assert.ok(
        !scriptPolicy.includes(digest(content + ';alert(1)')),
        'Tampered script must not be allowed',
      );
      checked++;
    }
    assert.ok(checked > 0);
    for (const directive of [
      "default-src 'self'",
      "script-src-attr 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "connect-src 'self'",
      "worker-src 'self'",
    ])
      assert.ok(csp.includes(directive));
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(
      response.headers.get('strict-transport-security'),
      'max-age=31536000',
    );
    assert.equal(
      response.headers.get('cross-origin-opener-policy'),
      'same-origin',
    );
    assert.equal(
      response.headers.get('cross-origin-resource-policy'),
      'same-origin',
    );
    assert.ok(response.headers.get('permissions-policy').includes('camera=()'));
  });

  await test('mutable shell revalidates while hashed scripts and fonts are immutable', async () => {
    for (const path of [
      entry,
      `${prefix}manifest.webmanifest`,
      `${prefix}index.rsc`,
    ]) {
      const response = await fetchPath(path);
      assert.equal(response.status, 200, path);
      assert.ok(
        response.headers.get('cache-control').includes('max-age=0'),
        path,
      );
      assert.ok(
        response.headers.get('cache-control').includes('must-revalidate'),
        path,
      );
      assert.ok(
        !response.headers.get('cache-control').includes('immutable'),
        path,
      );
    }
    const worker = await fetchPath(`${prefix}sw.js`);
    assert.ok(worker.headers.get('cache-control').includes('no-cache'));
    assert.equal(worker.headers.get('service-worker-allowed'), entry);
    const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    for (const extension of ['.js', '.woff2']) {
      const url = urls.find(
        (path) => path.endsWith(extension) && path.startsWith(prefix),
      );
      assert.ok(url);
      const response = await fetchPath(url);
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('cache-control'),
        'public, max-age=31536000, immutable',
      );
      assert.ok(
        response.headers
          .get('content-type')
          .includes(extension === '.js' ? 'javascript' : 'font/woff2'),
      );
    }
    for (const file of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
      assert.equal(
        (await fetchPath(prefix + file)).headers.get('cache-control'),
        'public, max-age=3600',
      );
    }
    assert.equal(
      (await fetchPath(prefix + 'icons/icon-512.png')).headers.get(
        'cache-control',
      ),
      'public, max-age=86400',
    );
    const head = await fetchPath(entry, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  });

  await test('aliases redirect; unknown paths, internal metadata and writes are not served as the app', async () => {
    for (const alias of [
      `${prefix}index.html`,
      `${prefix}index`,
      ...(base ? [prefix] : []),
    ]) {
      const response = await fetchPath(alias);
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), entry);
    }
    for (const path of [
      'missing-page',
      '404.html',
      '.openai/hosting.json',
      '.vite/manifest.json',
      'vinext-client-entry-manifest.json',
      '_headers',
      '_redirects',
      'missing.js.map',
    ]) {
      const response = await fetchPath(prefix + path);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-robots-tag'), 'noindex');
      const body = await response.text();
      assert.ok(!body.includes('<script'));
      assert.ok(!body.includes('rel="canonical"'));
      assert.equal((body.match(/name="robots"/g) ?? []).length, 1);
    }
    assert.equal(
      (await fetchPath(entry, { method: 'POST', body: 'no server writes' }))
        .status,
      405,
    );
    if (base) assert.equal((await fetchPath(base + '-other/')).status, 404);
  });

  await test('Vercel and Cloudflare output apply the same security policy without overlapping cache headers', async () => {
    assert.equal(deployment.version, 3);
    const actualCsp = (await fetchPath(entry)).headers.get(
      'content-security-policy',
    );
    assert.equal(
      deployment.routes[0].headers['Content-Security-Policy'],
      actualCsp,
    );
    assert.ok(rules.includes(`  Content-Security-Policy: ${actualCsp}`));
    assert.ok(rules.split('\n').every((line) => line.length <= 2000));
    const route = deployment.routes.find(
      (r) =>
        r.src &&
        new RegExp(r.src).test(entry) &&
        r.dest?.endsWith('/index.html'),
    );
    assert.equal(route.dest, prefix + 'index.html');
    assert.ok(!route.status || route.status === 200);
    assert.ok(deployment.routes.some((r) => r.handle === 'filesystem'));
    assert.equal(deployment.routes.at(-1).status, 404);
    assert.equal(deployment.routes.at(-1).dest, prefix + '404.html');
    const copiedRoot = resolve('.vercel/output/static', base.slice(1));
    const copied = await readFile(resolve(copiedRoot, 'index.html'), 'utf8');
    assert.equal(copied, html);
    const names = await readdir(copiedRoot);
    assert.ok(
      !names.some(
        (name) =>
          name.startsWith('.') ||
          [
            '_headers',
            '_redirects',
            'vinext-client-entry-manifest.json',
          ].includes(name),
      ),
    );
    for (const file of ['sw.js', 'manifest.webmanifest', 'sitemap.xml']) {
      const matches = deployment.routes.filter(
        (r) => r.src && new RegExp(r.src).test(prefix + file) && r.continue,
      );
      const cacheValues = matches
        .map((r) => r.headers?.['Cache-Control'])
        .filter(Boolean);
      assert.equal(
        cacheValues.length,
        1,
        `Duplicate cache headers for ${file}`,
      );
      assert.equal(
        cacheValues[0],
        (await fetchPath(prefix + file)).headers.get('cache-control'),
      );
    }
  });
} finally {
  if (server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
}
