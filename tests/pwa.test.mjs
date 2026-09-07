import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import vm from 'node:vm';
const root = resolve('dist/client');
const source = await readFile(resolve(root, 'sw.js'), 'utf8');
const handlers = {};
const stores = new Map();
let offline = false;
const context = vm.createContext({
  URL,
  Response,
  Promise,
  self: {
    location: { origin: 'https://streakfreak.test' },
    clients: { claim: async () => {} },
    addEventListener: (name, handler) => {
      handlers[name] = handler;
    },
  },
  fetch: async () => {
    if (offline) throw new Error('Offline');
    return new Response('Fresh app', {
      headers: { 'Content-Type': 'text/html' },
    });
  },
  caches: {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        addAll: async (urls) => {
          for (const url of urls) {
            const path = url === home ? 'index.html' : url.slice(home.length);
            const data = await readFile(resolve(root, path));
            store.set(
              url,
              new Response(data, {
                headers: {
                  'Content-Type':
                    extname(path) === '.html'
                      ? 'text/html'
                      : 'application/octet-stream',
                },
              }),
            );
          }
        },
        match: async (key) => store.get(key)?.clone(),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (key) => stores.delete(key),
  },
});
vm.runInContext(source, context);
const assets = vm.runInContext('ASSETS', context);
const home = vm.runInContext('HOME', context);
const cache = vm.runInContext('CACHE', context);
const prefix = vm.runInContext('PREFIX', context);
await test('production files are complete and canonical metadata is correct', async () => {
  assert.ok(assets.length > 5);
  for (const url of assets) {
    assert.ok(url.startsWith(home));
    assert.ok(!url.includes('/server/'));
    const file = resolve(
      root,
      url === home ? 'index.html' : url.slice(home.length),
    );
    await readFile(file);
  }
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.ok(html.includes('https://lowkey.tools/streakfreak'));
  assert.ok(html.includes(`${home}manifest.webmanifest`));
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (!url.startsWith('/') || !url.includes('_next/')) continue;
    assert.ok(url.startsWith(home), `Unscoped asset: ${url}`);
    await readFile(resolve(root, url.slice(home.length)));
  }
  assert.ok(!html.includes('fonts.googleapis.com'));
  assert.ok(!html.includes('Untitled site'));
  const manifest = JSON.parse(
    await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'),
  );
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of manifest.icons) await readFile(resolve(root, icon.src));
});
await test('worker installs its complete shell and only deletes its own obsolete caches', async () => {
  let installing = Promise.resolve();
  handlers.install({
    waitUntil: (p) => {
      installing = p;
    },
  });
  await installing;
  assert.equal(stores.get(cache).size, assets.length);
  stores.set(prefix + 'old', new Map());
  stores.set('another-app-cache', new Map());
  let activating = Promise.resolve();
  handlers.activate({
    waitUntil: (p) => {
      activating = p;
    },
  });
  await activating;
  assert.equal(stores.has(prefix + 'old'), false);
  assert.equal(stores.has('another-app-cache'), true);
  assert.equal(stores.has(cache), true);
});
await test('navigation uses the network online and the cached app offline', async () => {
  const navigation = {
    url: `https://streakfreak.test${home}`,
    method: 'GET',
    mode: 'navigate',
  };
  let response = Promise.resolve(new Response());
  handlers.fetch({
    request: navigation,
    respondWith: (p) => {
      response = p;
    },
  });
  assert.equal(await (await response).text(), 'Fresh app');
  offline = true;
  handlers.fetch({
    request: navigation,
    respondWith: (p) => {
      response = p;
    },
  });
  const html = await (await response).text();
  assert.ok(html.includes('Keep showing up'));
  assert.ok(html.includes('manifest.webmanifest'));
  offline = false;
});
await test('worker never handles writes, external requests, or unknown resources', () => {
  let intercepted = false;
  for (const request of [
    {
      url: `https://streakfreak.test${home}`,
      method: 'POST',
      mode: 'same-origin',
    },
    { url: 'https://external.test/data', method: 'GET', mode: 'cors' },
    {
      url: `https://streakfreak.test${home}unrelated.json`,
      method: 'GET',
      mode: 'same-origin',
    },
  ])
    handlers.fetch({
      request,
      respondWith: () => {
        intercepted = true;
      },
    });
  assert.equal(intercepted, false);
});
await test('pre-cached JavaScript remains available offline', async () => {
  const asset = assets.find((p) => p.endsWith('.js'));
  assert.ok(asset);
  offline = true;
  let response = Promise.resolve(new Response());
  handlers.fetch({
    request: {
      url: `https://streakfreak.test${asset}`,
      method: 'GET',
      mode: 'same-origin',
    },
    respondWith: (p) => {
      response = p;
    },
  });
  assert.ok((await (await response).text()).length > 0);
  offline = false;
});
