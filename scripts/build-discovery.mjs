import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function buildDiscovery(output) {
  const site = JSON.parse(
    await readFile(
      new URL('../lib/site-content.json', import.meta.url),
      'utf8',
    ),
  );
  const xml = (text) =>
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  await writeFile(
    join(output, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${xml(site.canonical)}</loc></url>
</urlset>
`,
  );
  await writeFile(
    join(output, 'robots.txt'),
    `# Streakfreak: public product information; habit data stays in IndexedDB.
# The wildcard also permits compliant search and answer-engine crawlers.
User-agent: *
Allow: /

Sitemap: ${new URL('sitemap.xml', site.canonical).href}
`,
  );
  await writeFile(
    join(output, 'llms.txt'),
    `# ${site.name}

> ${site.summary}

Canonical URL: ${site.canonical}

## Official links

- [Streakfreak](${site.canonical}): Free habit tracker, product guide and frequently asked questions.
- [OwlEye Analytics](https://owleye.dev): From the makers of OwlEye Analytics; publisher of Streakfreak.
- [Shrinath Prabhu](https://shrinath.me): Creator of Streakfreak and founder of OwlEye Analytics.
- [Follow Shrinath on X](https://x.com/shrinath_prabhu): Updates from the maker.
- [Lowkey Tools](https://lowkey.tools): The collection that includes Streakfreak.

## A companion for your routine

- [${site.companion.name}](${site.companion.url}): ${site.companion.description}

## Features

${site.features.map((feature) => `- ${feature}`).join('\n')}

## Questions and answers

${site.faqs.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}

## Data and availability

This file describes the public application only. Personal habits and notes are never included in site HTML, structured data, sitemaps or this file. There is no server-side habit database, automatic device sync, wearable integration or sensor tracking. Template goals are customizable examples, not personalized health advice. Browser storage is scoped to each origin; export and import JSON to move between domains, browsers or devices. Installation and offline caching require HTTPS and a compatible browser.
`,
  );
}
