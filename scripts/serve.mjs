import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
import {
  publicFiles,
  contentSecurityPolicy,
  securityHeaders,
  resourceHeaders,
  REVALIDATE,
} from './hosting-rules.mjs';
const root = resolve('dist/client');
const port = Number(process.env.PORT || 4173);
const publicPaths = new Set(await publicFiles(root));
const commonHeaders = securityHeaders(await contentSecurityPolicy(root));
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
const server = createServer(async (req, res) => {
  for (const [key, value] of Object.entries(commonHeaders))
    res.setHeader(key, value);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
    res.end('Method not allowed');
    return;
  }
  try {
    const url = new URL(req.url, 'http://localhost');
    const aliases = ['/index', '/index.html'];
    if (aliases.includes(url.pathname)) {
      res.writeHead(308, { Location: '/', 'Cache-Control': REVALIDATE });
      res.end();
      return;
    }
    const path = resolve(
      root,
      url.pathname === '/'
        ? './index.html'
        : '.' + decodeURIComponent(url.pathname),
    );
    if (!path.startsWith(root + '/') && path !== root)
      throw new Error('Not found');
    const file = relative(root, path);
    if (!publicPaths.has(file) || file === '404.html')
      throw new Error('Not found');
    const data = await readFile(path);
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
      ...resourceHeaders(file),
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8',
      ...resourceHeaders('404.html'),
    });
    res.end(
      req.method === 'HEAD'
        ? undefined
        : await readFile(resolve(root, '404.html')),
    );
  }
});
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`Streakfreak static preview: http://127.0.0.1:${address.port}/`);
});
