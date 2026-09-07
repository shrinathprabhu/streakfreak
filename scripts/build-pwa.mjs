import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { buildDiscovery } from './build-discovery.mjs';
import {
  publicFiles,
  contentSecurityPolicy,
  securityHeaders,
  staticErrorPage,
  cloudflareHeaders,
} from './hosting-rules.mjs';
const output = join(process.cwd(), 'dist/client');
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const prefix = `${base}/`;
const scope = base || '/';
await buildDiscovery(output);
const manifestPath = join(output, 'manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (base) {
  // Cover the exact, slashless canonical entry URL as well as app assets.
  manifest.id = base;
  manifest.start_url = base;
  manifest.scope = base;
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const paths = (await publicFiles(output))
  .filter((file) => file !== 'sw.js')
  .map((file) => join(output, file));
if (!paths.some((p) => relative(output, p) === 'index.html'))
  throw new Error('Static index.html is required.');
// Keep the static export mountable under a subpath without a server router.
// App-owned URLs already use NEXT_PUBLIC_BASE_PATH; normalize framework chunks.
if (base) {
  for (const path of paths.filter((p) => /\.(js|css|html|rsc|json)$/.test(p))) {
    const content = await readFile(path, 'utf8');
    const scoped = content.replace(
      /(?<![A-Za-z0-9/_-])\/_next\//g,
      `${base}/_next/`,
    );
    if (scoped !== content) await writeFile(path, scoped);
  }
}
const errorPage = join(output, '404.html');
await writeFile(errorPage, staticErrorPage(await readFile(errorPage, 'utf8')));
const csp = await contentSecurityPolicy(output);
const hash = createHash('sha256');
// Header changes must also refresh the cached document's security policy.
hash.update(JSON.stringify(securityHeaders(csp)));
for (const p of paths) hash.update(await readFile(p));
const version = hash.digest('hex').slice(0, 16);
const assets = [
  scope,
  // Cache the 200 entry URL once. Redirected index/slash aliases are unsuitable
  // offline navigation responses and would download the same HTML twice.
  ...paths
    .filter((p) => relative(output, p) !== 'index.html')
    .map((p) => `${prefix}${relative(output, p).split('\\').join('/')}`),
];
const worker = `/* Generated from the exact static build. No habit data enters this cache. */
const PREFIX=${JSON.stringify(`streakfreak-shell-${base || 'root'}-`)};
const CACHE=PREFIX+${JSON.stringify(version)};
const HOME=${JSON.stringify(prefix)};
const ENTRY=${JSON.stringify(scope)};
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||(url.pathname!==ENTRY&&!url.pathname.startsWith(HOME)))return;
  if(request.mode==='navigate'){
    // Unknown routes must keep their real HTTP status, including 404s.
    if(![ENTRY,HOME,HOME+'index.html'].includes(url.pathname))return;
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try {
        const response=await fetch(request);
        if(response.ok&&!response.redirected&&(response.headers.get('content-type')||'').includes('text/html'))return response;
      } catch {}
      return (await cache.match(ENTRY)) || new Response('Open Streakfreak online once to enable offline use.',{status:503,headers:{'Content-Type':'text/plain'}});
    })());
    return;
  }
  if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(cached=>cached||fetch(request)));
});
`;
await writeFile(join(output, 'sw.js'), worker);
await writeFile(
  join(output, '_headers'),
  await cloudflareHeaders(output, base, csp),
);
console.log(
  `Offline shell ready: ${assets.length} assets, scope ${prefix}, version ${version}.`,
);
