import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const REVALIDATE = 'public, max-age=0, must-revalidate';
export const IMMUTABLE = 'public, max-age=31536000, immutable';

export async function publicFiles(root, directory = '') {
  const files = [];
  for (const entry of await readdir(join(root, directory), {
    withFileTypes: true,
  })) {
    if (entry.name.startsWith('.')) continue;
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await publicFiles(root, path)));
    else if (
      entry.isFile() &&
      /\.(?:js|css|woff2?|png|svg|webmanifest|html|rsc|json|txt|xml)$/.test(
        path,
      ) &&
      path !== 'vinext-client-entry-manifest.json'
    )
      files.push(path);
  }
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}

export function inlineScriptHashes(html) {
  return [
    ...new Set(
      [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter(
          ([, attrs, source]) =>
            source.trim() &&
            !/\bsrc\s*=/.test(attrs) &&
            !/\btype=["']application\/(?:ld\+)?json["']/i.test(attrs),
        )
        .map(
          ([, , source]) =>
            `'sha256-${createHash('sha256').update(source).digest('base64')}'`,
        ),
    ),
  ];
}

export async function contentSecurityPolicy(root) {
  const html = await Promise.all(
    (await publicFiles(root))
      .filter((file) => file.endsWith('.html'))
      .map((file) => readFile(join(root, file), 'utf8')),
  );
  const hashes = [...new Set(html.flatMap(inlineScriptHashes))];
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "script-src-attr 'none'",
    // React and Base UI use inline styles for progress and dialog positioning.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  // Cloudflare counts the entire _headers line, including its name and indent.
  if (`  Content-Security-Policy: ${policy}`.length > 2000)
    throw new Error(
      'CSP exceeds the static host’s 2,000-character header limit. Reduce inline startup scripts before publishing.',
    );
  return policy;
}

export function securityHeaders(csp) {
  return {
    'Content-Security-Policy': csp,
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-DNS-Prefetch-Control': 'off',
  };
}

export function resourceHeaders(file, base = '') {
  const headers = { 'Cache-Control': REVALIDATE };
  if (file.startsWith('_next/static/')) headers['Cache-Control'] = IMMUTABLE;
  else if (/\.(?:png|svg)$/.test(file))
    headers['Cache-Control'] = 'public, max-age=86400';
  else if (/\.(?:txt|xml)$/.test(file))
    headers['Cache-Control'] = 'public, max-age=3600';
  if (file === 'sw.js') {
    headers['Cache-Control'] = 'no-cache, max-age=0, must-revalidate';
    headers['Service-Worker-Allowed'] = base || '/';
  }
  if (file === '404.html') {
    headers['Cache-Control'] = 'no-store';
    headers['X-Robots-Tag'] = 'noindex';
  }
  if (file.endsWith('.xml'))
    headers['Content-Type'] = 'application/xml; charset=utf-8';
  if (file.endsWith('.txt'))
    headers['Content-Type'] = 'text/plain; charset=utf-8';
  if (file.endsWith('.webmanifest'))
    headers['Content-Type'] = 'application/manifest+json';
  return headers;
}

export function staticErrorPage(html) {
  // The exported 404 has no interactive controls. Keep its rendered content,
  // discard unused hydration scripts, and give it unambiguous noindex metadata.
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*name=["']robots["'][^>]*>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(
      /<title>[\s\S]*?<\/title>/i,
      '<title>Page not found — Streakfreak</title>',
    )
    .replace('</head>', '<meta name="robots" content="noindex"/></head>');
}

export async function cloudflareHeaders(root, base, csp) {
  const rule = (path, headers) =>
    `${path}\n${Object.entries(headers)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join('\n')}\n`;
  const prefix = `${base}/`;
  let output = rule('/*', securityHeaders(csp));
  output += rule(base || '/', resourceHeaders('index.html', base));
  if (base) output += rule(prefix, resourceHeaders('index.html', base));
  output += rule(`${prefix}_next/static/*`, { 'Cache-Control': IMMUTABLE });
  for (const file of await publicFiles(root)) {
    if (!file.startsWith('_next/static/'))
      output += rule(prefix + file, resourceHeaders(file, base));
  }
  if (output.split('\n').filter((line) => line.startsWith('/')).length > 100)
    throw new Error(
      'Too many static header rules for Cloudflare. Group resource rules before publishing.',
    );
  return output;
}
