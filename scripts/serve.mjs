import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('dist/client');
const port = Number(process.env.PORT || 4173);
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.rsc': 'text/x-component',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (base && url.pathname === base + '/') {
      res.writeHead(308, { Location: base + url.search });
      res.end();
      return;
    }
    if (url.pathname !== base && !url.pathname.startsWith(base + '/'))
      throw new Error('Not found');
    let path = resolve(
      root,
      '.' + decodeURIComponent(url.pathname.slice(base.length)),
    );
    if (!path.startsWith(root + '/') && path !== root)
      throw new Error('Not found');
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const data = await readFile(path);
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      ...(extname(path) === '.js' && path.endsWith('/sw.js')
        ? { 'Service-Worker-Allowed': base || '/' }
        : {}),
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Streakfreak static preview: http://127.0.0.1:${port}${base}/`),
);
