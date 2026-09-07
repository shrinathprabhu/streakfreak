import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const output = join(process.cwd(), 'dist/client');
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const prefix = `${base}/`;
async function files(dir) {
  const results = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) results.push(...(await files(path)));
    else results.push(path);
  }
  return results;
}
const paths = (await files(output))
  .filter(
    (p) =>
      /\.(js|css|woff2?|png|svg|webmanifest|html|rsc|json)$/.test(p) &&
      !p.endsWith('/sw.js'),
  )
  .sort();
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
const hash = createHash('sha256');
for (const p of paths) hash.update(await readFile(p));
const version = hash.digest('hex').slice(0, 16);
const assets = [
  prefix,
  ...paths.map((p) => `${prefix}${relative(output, p).split('\\').join('/')}`),
];
const worker = `/* Generated from the exact static build. No habit data enters this cache. */
const PREFIX=${JSON.stringify(`streakfreak-shell-${base || 'root'}-`)};
const CACHE=PREFIX+${JSON.stringify(version)};
const HOME=${JSON.stringify(prefix)};
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
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(HOME))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try {
        const response=await fetch(request);
        if(response.ok&&!response.redirected&&(response.headers.get('content-type')||'').includes('text/html'))return response;
      } catch {}
      return (await cache.match(HOME)) || new Response('Open Streakfreak online once to enable offline use.',{status:503,headers:{'Content-Type':'text/plain'}});
    })());
    return;
  }
  if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(cached=>cached||fetch(request)));
});
`;
await writeFile(join(output, 'sw.js'), worker);
await writeFile(
  join(output, '_headers'),
  `${prefix}sw.js\n  Cache-Control: no-cache\n  Service-Worker-Allowed: ${prefix}\n${prefix}index.html\n  Cache-Control: no-cache\n${prefix}manifest.webmanifest\n  Cache-Control: no-cache\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`,
);
console.log(
  `Offline shell ready: ${assets.length} assets, scope ${prefix}, version ${version}.`,
);
