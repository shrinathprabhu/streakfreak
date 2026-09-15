import { mkdir, copyFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import {
  publicFiles,
  contentSecurityPolicy,
  cloudflareHeaders,
} from './hosting-rules.mjs';

const source = resolve('dist/client');
const output = resolve('dist/workers');
const files = await publicFiles(source);
for (const required of [
  'index.html',
  '404.html',
  'sw.js',
  'manifest.webmanifest',
]) {
  if (!files.includes(required))
    throw new Error(`Missing ${required}; run npm run build first.`);
}
// Deploy only public assets; framework build metadata and server intermediates stay local.
await rm(output, { recursive: true, force: true });
for (const file of files) {
  const destination = join(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(source, file), destination);
}
const csp = await contentSecurityPolicy(output);
await writeFile(join(output, '_headers'), await cloudflareHeaders(output, csp));
// Workers Static Assets uses the real 404 page through assets.not_found_handling.
await writeFile(
  join(output, '_redirects'),
  '/index / 308\n/index.html / 308\n',
);
console.log(
  `Cloudflare Workers deployment ready: ${files.length} public files in dist/workers.`,
);
