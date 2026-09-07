import { mkdir, copyFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import {
  publicFiles,
  contentSecurityPolicy,
  securityHeaders,
  resourceHeaders,
  REVALIDATE,
} from './hosting-rules.mjs';

const source = resolve('dist/client');
const output = resolve('.vercel/output');
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
if (base && !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(base))
  throw new Error('Invalid NEXT_PUBLIC_BASE_PATH.');
const entry = base || '/';
const prefix = `${base}/`;
const files = await publicFiles(source);
const csp = await contentSecurityPolicy(source);
// Only generated deployment output is replaced; .vercel/project.json is kept.
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'static'), { recursive: true });
for (const file of files) {
  const destination = join(output, 'static', base.slice(1), file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(source, file), destination);
}
const exact = (path) => `^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
const error = {
  dest: `${prefix}404.html`,
  status: 404,
  headers: resourceHeaders('404.html', base),
};
const routes = [
  { src: '/(.*)', headers: securityHeaders(csp), continue: true },
  {
    src: '/(.*)',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    status: 405,
    headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
  },
  ...[`${prefix}index`, `${prefix}index.html`, ...(base ? [prefix] : [])].map(
    (alias) => ({
      src: exact(alias),
      status: 308,
      headers: { Location: entry, 'Cache-Control': REVALIDATE },
    }),
  ),
  ...[`${prefix}404`, `${prefix}404.html`].map((path) => ({
    src: exact(path),
    ...error,
  })),
  ...files
    .filter((file) => file !== '404.html')
    .map((file) => ({
      src: exact(prefix + file),
      headers: resourceHeaders(file, base),
      continue: true,
    })),
  {
    src: exact(entry),
    dest: `${prefix}index.html`,
    headers: resourceHeaders('index.html', base),
  },
  { handle: 'filesystem' },
  { src: '/(.*)', ...error },
];
await writeFile(
  join(output, 'config.json'),
  JSON.stringify({ version: 3, routes }, null, 2) + '\n',
);
console.log(
  `Vercel static deployment ready: ${files.length} files mounted at ${entry}.`,
);
