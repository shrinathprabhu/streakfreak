import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('dist/client');
const site = JSON.parse(await readFile('lib/site-content.json', 'utf8'));
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

await test('static HTML has consistent canonical, social and mobile metadata', () => {
  assert.equal(site.canonical, 'https://streakfreak.lowkey.tools/');
  const canonical = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)];
  assert.equal(canonical.length, 1);
  assert.equal(canonical[0][0].match(/href="([^"]+)"/)[1], site.canonical);
  for (const [key, value] of [
    ['description', site.description],
    ['og:title', site.title],
    ['og:description', site.description],
    ['og:url', site.canonical],
    ['og:site_name', site.name],
    ['og:image', new URL('og-image.png', site.canonical).href],
    ['og:image:width', '1734'],
    ['og:image:height', '907'],
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', site.title],
    ['twitter:image', new URL('og-image.png', site.canonical).href],
    ['twitter:creator', '@shrinath_prabhu'],
  ]) {
    assert.ok(
      [...html.matchAll(/<meta\b[^>]*>/g)].some(
        ([tag]) =>
          tag.includes(`="${key}"`) &&
          tag.includes(`content="${escape(value)}"`),
      ),
      key,
    );
  }
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /name="viewport"[^>]*content="[^"]*width=device-width/);
  assert.ok(html.includes('viewport-fit=cover'));
  assert.ok(!/user-scalable=no|maximum-scale=1/.test(html));
  assert.match(html, /name="robots"[^>]*content="[^"]*index, follow/);
});

await test('product facts, FAQ answers and followed maker links are visible without JavaScript', () => {
  assert.equal((visible.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((visible.match(/<main\b/g) ?? []).length, 1);
  assert.ok(visible.indexOf('</main>') < visible.indexOf('<footer'));
  assert.ok(visible.includes('href="#main"'));
  for (const faq of site.faqs) {
    assert.ok(visible.includes(`id="${faq.id}"`));
    assert.ok(visible.includes(escape(faq.question)), faq.question);
    assert.ok(visible.includes(escape(faq.answer)), faq.id);
  }
  for (const url of ['https://owleye.dev', 'https://shrinath.me']) {
    const links = [...visible.matchAll(/<a\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => tag.includes(`href="${url}"`));
    assert.ok(links.length >= 3, `Visible creator links for ${url}`);
    assert.ok(links.every((tag) => !tag.includes('nofollow')));
  }
  for (const url of [
    'https://lowkey.tools',
    'https://x.com/shrinath_prabhu',
    site.companion.url,
  ]) {
    assert.ok(
      visible.includes(`href="${url}"`),
      `Missing visible link: ${url}`,
    );
  }
  assert.equal(
    [...visible.matchAll(/<a\b[^>]*href="https:\/\/[^"/]+\.lowkey\.tools\/?"/g)]
      .length,
    1,
    'Recommend exactly one sibling tool',
  );
});

await test('JSON-LD describes the real application and exactly matches visible FAQ content', () => {
  const scripts = [
    ...html.matchAll(
      /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ];
  assert.equal(scripts.length, 1);
  const schema = JSON.parse(scripts[0][1]);
  assert.equal(schema['@context'], 'https://schema.org');
  const graph = schema['@graph'];
  const website = graph.find((node) => node['@type'] === 'WebSite');
  assert.equal(website.name, site.name);
  assert.equal(website.url, site.canonical);
  assert.equal(website['@id'], `${site.canonical}#website`);
  assert.equal(website.isPartOf['@id'], 'https://lowkey.tools/#website');
  const page = graph.find((node) => node['@type'] === 'WebPage');
  assert.equal(page.url, site.canonical);
  assert.equal(page.isPartOf['@id'], website['@id']);
  const app = graph.find((node) => node['@type'] === 'WebApplication');
  assert.equal(app.url, site.canonical);
  assert.equal(app.isAccessibleForFree, true);
  assert.deepEqual(app.featureList, site.features);
  assert.equal(app.author['@id'], 'https://shrinath.me/#person');
  assert.equal(app.publisher['@id'], 'https://owleye.dev/#organization');
  assert.equal(app.isPartOf['@id'], website['@id']);
  assert.deepEqual(graph.find((node) => node['@type'] === 'Person').sameAs, [
    'https://x.com/shrinath_prabhu',
  ]);
  const faq = graph.find((node) => node['@type'] === 'FAQPage');
  assert.equal(faq.url, `${site.canonical}#faq`);
  assert.ok(
    faq.mainEntity.every((q) => q['@id'].startsWith(`${site.canonical}#`)),
  );
  assert.deepEqual(
    faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]),
    site.faqs.map((q) => [q.question, q.answer]),
  );
  assert.ok(!JSON.stringify(schema).includes('aggregateRating'));
});

await test('crawler files contain only the canonical product URL and public facts', async () => {
  const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.ok(
    sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'),
  );
  assert.deepEqual(
    [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
    [site.canonical],
  );
  const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent: \*\nAllow: \//);
  assert.ok(
    robots.includes(`Sitemap: ${new URL('sitemap.xml', site.canonical).href}`),
  );
  const llms = await readFile(resolve(root, 'llms.txt'), 'utf8');
  assert.ok(llms.startsWith('# Streakfreak\n'));
  for (const text of [
    site.canonical,
    'https://owleye.dev',
    'https://shrinath.me',
    site.companion.url,
    site.companion.description,
    ...site.faqs.map((q) => q.answer),
  ])
    assert.ok(llms.includes(text));
  assert.ok(
    !/chatgpt\.site|localhost|habitId|updatedAt/.test(sitemap + robots + llms),
  );
  assert.ok(
    !(html + sitemap + robots + llms).includes(
      'https://lowkey.tools/streakfreak',
    ),
  );
  for (const [file, expected] of [
    ['sitemap.xml', sitemap],
    ['robots.txt', robots],
    ['llms.txt', llms],
  ]) {
    assert.equal(
      await readFile(resolve('dist/workers', file), 'utf8'),
      expected,
    );
  }
  const headers = await readFile(resolve(root, '_headers'), 'utf8');
  assert.ok(headers.includes('max-age=31536000, immutable'));
  assert.ok(headers.includes('Content-Type: application/xml; charset=utf-8'));
});

await test('the landscape social image ships intact in the Workers deployment', async () => {
  const image = await readFile(resolve(root, 'og-image.png'));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), 1734);
  assert.equal(image.readUInt32BE(20), 907);
  assert.deepEqual(await readFile('dist/workers/og-image.png'), image);
});
