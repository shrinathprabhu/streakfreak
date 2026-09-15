# Streakfreak

A frontend-only, installable habit tracker. No login, analytics, backend, subscription, or cloud habit storage. The UI uses React 19, TypeScript, Vinext’s static export, Base UI/Shadcn primitives, Lucide icons, and plain CSS with Tailwind utilities.

Typography uses [Geist Sans by Vercel](https://vercel.com/font), bundled locally as a 69.7 KB variable WOFF2. Headings, body text and controls share the font. `next/font/local` provides a preload and `font-display: swap`; the service worker caches the font for offline use. The original OFL license ships with the site. Font source details are in `app/fonts/README.md`.

## Run

Node 22.13+.

```sh
npm ci
npm run dev
```

Production output is entirely static:

```sh
npm run build
npm start
```

Serve `dist/client/` on any HTTPS static host. `npm start` is only a local static file preview. `dist/server/` contains build intermediates and is not deployed. Workers Static Assets hosts the files without an application Worker script, database service, API keys, or runtime secrets.

## What works

- Daily numeric check-ins, custom names/units, minimum goals and maximum limits.
- Water, steps, sleep, and screen-time presets, plus reading, meditation, exercise, and journaling. All presets use the same schema.
- First run creates four editable habits, with no invented history.
- Full-year heatmap with habit filtering, leap years, year navigation, arrow-key navigation, and date selection.
- Backdated entries from a habit’s start date; no future check-ins.
- Optional reflections/outcome notes for each check-in, with a closing-note shortcut on completed habits and a note excerpt on the daily card. Reopen any day to read or edit its reflection.
- Current and best streaks, both across the journal and per habit.
- Edit/delete habits, update/clear check-ins, and confirm permanent habit deletion.
- Complete JSON backups, CSV exports, and validated, atomic JSON merge imports.
- Offline shell, installable manifest, PNG/maskable/Apple icons, installation guidance, and optional persistent browser storage.
- Accessible dialogs, labeled inputs, touch layouts, responsive grids, reduced-motion support, and visible save errors.

## Data and streak semantics

IndexedDB database `streakfreak`, version 1:

| Store     | Key                  | Contents                                                                                  |
| --------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `habits`  | `id`                 | name, description, unit, target, direction, icon, color, startDate                        |
| `entries` | `habitId:YYYY-MM-DD` | habitId, local date, value, target snapshot, direction snapshot, updatedAt, optional note |
| `meta`    | string               | idempotent initialization flag                                                            |

`direction` is `atLeast` or `atMost`. An absent entry never completes a goal, even for a maximum limit. An explicitly logged zero can complete a limit. Habit targets are user-defined presets, not health recommendations.

Every entry snapshots its goal and direction at its first save. Editing a habit affects newly created entries; updating an existing entry retains its original goal. Start-date edits cannot strand existing entries. All writes resolve only after the IndexedDB transaction commits; a failed transaction does not produce a success message. BroadcastChannel refreshes other open tabs.

Reflections use an optional `note` string on the same daily entry, up to 2,000 characters. No IndexedDB version change is needed, and existing version-1 backups remain valid. Numeric-only updates and legacy imports that omit `note` preserve an existing reflection; an explicitly empty note clears it. Deleting a check-in also deletes its reflection. JSON backups include notes and CSV appends a `note` column for report preparation, preserving multiline text and escaping spreadsheet formula prefixes. This provides report data; it does not generate a separate formatted report document.

A streak counts consecutive **local calendar dates** with at least one goal met (or that specific habit met). Today may remain incomplete without breaking yesterday’s streak. A missed prior day resets the current streak; the historical best remains. Calendar arithmetic uses local noon to handle daylight saving safely.

Imports validate schema version, IDs, references, bounds, duplicate records, local dates, amounts, and goal snapshots before merging. Matching imported IDs overwrite corresponding local records; unrelated records remain. Earlier local start dates are preserved when needed for local history. JSON imports are limited to 10 MB, 500 habits and 200,000 entries. CSV text is quoted and spreadsheet formula prefixes are escaped.

## Privacy and offline behavior

Habits stay in this browser’s IndexedDB. Export/import is entirely local. There are no remote fonts, analytics, fetch calls carrying habit data, or cloud sync. Standard web hosting still serves app files and may keep ordinary HTTP access logs.

Browser storage is scoped to the origin: `streakfreak.lowkey.tools` and `lowkey.tools` do not share a database. Use JSON export/import when moving between domains, browsers, profiles, or devices. Clearing site data or using a private browsing session can remove records. Persistent-storage permission reduces eviction risk but does not replace backups.

The generated service worker precaches the exact built HTML, scripts, styles, and app icons; social preview artwork is not needed offline. It only handles GET requests for the app’s own origin and scope. Offline navigation returns the precached app shell; IndexedDB remains separate from the shell cache. New releases install a new version and activate once existing tabs close. Obsolete Streakfreak shell caches are removed without clearing habit data. No production service worker is registered in development.

PWA installation and offline caching need HTTPS (localhost works for development). See [MDN’s service-worker guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) and [manifest scope documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope).

## Domain and canonical URL

Deploy Streakfreak directly at **https://streakfreak.lowkey.tools/**. The canonical page, social metadata and structured data all use that root URL with a trailing slash. SEO URLs are absolute, so metadata does not need `metadataBase`; this preserves the slash in the framework's rendered canonical and Open Graph URLs, matching the sitemap and `llms.txt` exactly. Both spellings of a domain root resolve to the same page. All builds serve the app and its assets at `/`; no path-prefix environment variable, hub proxy or rewrite is required.

The manifest keeps `./` as its ID, start URL and scope, resolving to the domain root. The service worker registers at `/sw.js` with scope `/` and `Service-Worker-Allowed: /`. Its offline fallback handles the home page and index alias only; unknown routes retain their 404 status.

Serve JavaScript with its proper MIME type and `sw.js` without a long-lived immutable cache. The build emits Cloudflare-compatible `_headers`; the Workers deployment and local static preview apply the same policies. Hashed framework assets can be cached for a year; HTML and the worker revalidate. Enable the host's Brotli/gzip compression.

Moving from the private preview to the production domain creates a separate browser storage origin. Export a JSON backup from the old origin, then import it on the new domain to carry over habits and reflections. Connecting a domain does not transfer IndexedDB data.

## Security headers and caching

`scripts/hosting-rules.mjs` is the shared policy source for Cloudflare `_headers`, the local static server and the Workers static asset package. Security policy changes also change the PWA cache version so old cached documents can receive the new policy.

- CSP allows same-origin resources and exact SHA-256 hashes of the exported startup scripts. It disallows arbitrary inline JavaScript, inline event attributes, `eval`, object embeds, base tags, form navigation and framing. Inline **styles** remain allowed because React and Base UI use them for sizing and positioning. Font loading, local file import, Blob downloads and service-worker requests remain supported. JSON-LD is an inert data block and does not need executable script permission.
- HSTS lasts one year and applies to the serving host, without a preload registration or a policy imposed on unrelated subdomains. Framing is also denied through `X-Frame-Options`; MIME sniffing is disabled. The policy includes `no-referrer`, same-origin opener/resource protection, disabled DNS prefetch, and disabled camera, microphone, location, payment and USB permissions.
- The exported 404 keeps its static content but discards unused hydration scripts, canonical metadata and conflicting index directives. The local server returns 404 with `no-store` and `X-Robots-Tag: noindex` for missing pages. Unsupported write methods receive 405.
- Workers and the local server expose only the public static asset list, excluding dotfiles, host configuration, source maps and the internal client-entry manifest. They have no catch-all rewrite to a successful app page.

| Resource                                       | Browser cache policy                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| App HTML, RSC payload, web manifest            | `public, max-age=0, must-revalidate`                                                   |
| Service worker                                 | `no-cache, max-age=0, must-revalidate` plus the correct `Service-Worker-Allowed` scope |
| Hashed `/_next/static/` scripts, CSS and fonts | `public, max-age=31536000, immutable`                                                  |
| Unversioned icons, social image and favicon                  | `public, max-age=86400`                                                                |
| Sitemap, robots, llms and font license         | `public, max-age=3600`                                                                 |
| Missing pages and rejected writes in the local preview | `no-store`                                                                             |

The build rejects an oversized CSP instead of weakening it to allow arbitrary scripts. Local server and Workers runtime checks verify the generated policies. Final production headers still need verification after deploying to Cloudflare; local configuration does not change the existing Sites preview's hosting policy. References: [CSP script hashes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src), [Cloudflare header rules and limits](https://developers.cloudflare.com/workers/static-assets/headers/).

## Cloudflare Workers

Cloudflare Workers Static Assets is the Cloudflare deployment target. `npm run build` (also available as `npm run build:workers`) creates `dist/workers/` with only public files, the shared `_headers` policy, permanent index redirects in `_redirects`, and a sanitized `404.html`. No application Worker script, server bundle, bindings or backend is deployed.

Create a **Worker** with Git integration and use these settings:

| Setting | Value |
| --- | --- |
| Worker name | `streakfreak` (must match `cloudflare/wrangler.json`) |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build:workers` |
| Deploy command | `npm run deploy:workers:ci` |
| Non-production branch deploy command | `npm run deploy:workers:preview` |
| Static assets directory | `dist/workers`, declared in Wrangler config |
| Node.js | `24`, selected by `.node-version` |
| App environment variables and bindings | None |
| Custom domain | `streakfreak.lowkey.tools`, declared in `routes` with `custom_domain: true` |

Workers Builds installs dependencies from the npm lockfile. Use the commands above explicitly: the config lives under `cloudflare/` to keep Vinext's static export separate from its automatic server Workers integration. Assets paths resolve relative to that config. Both build commands also write `.wrangler/deploy/config.json`, pointing to the nested config, so a default `npx wrangler deploy` after the build discovers it correctly. This generated control file is ignored by Git and never copied into public assets. There is no Pages output-directory setting, framework preset or `pages_build_output_dir`. The compatibility date matches the installed Wrangler runtime baseline. Remove conflicting Node version overrides in the build dashboard.

For local Cloudflare runtime preview:

```sh
npm run build:workers
npm run preview:workers
```

For a manual release after authenticating to the intended Cloudflare account:

```sh
npx wrangler login
npm run deploy:workers
```

The manual deploy command builds fresh output first. Workers Builds uses separate build and deploy steps, avoiding a duplicate build. To validate packaging without uploading or publishing:

```sh
npm run deploy:workers:ci -- --dry-run
```

If deployment shows **“Proceed with setup?”** followed by **ERESOLVE**, Wrangler has entered automatic framework setup rather than loading this app's config. That setup can try to install a newer Wrangler incompatible with the pinned Workers types. Keep the repository root and build/deploy commands above in **Settings → Build**. The CI scripts select the installed Wrangler and pass `--config` explicitly; they do not install adapters or upgrade dependencies. The checked-in Wrangler 4.92.0, Vite plugin 1.37.1 and Workers types 4.20260515.1 are compatible. Use `npm ci` with the committed lockfile; do not bypass peer checks with `--force` or `--legacy-peer-deps`. The build-generated config pointer also supports the default root deploy command after a successful build. See [automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/) and [generated config discovery](https://developers.cloudflare.com/workers/wrangler/configuration/#generated-wrangler-configuration).

`cloudflare/wrangler.json` declares `streakfreak.lowkey.tools` under `routes` with `custom_domain: true`. The hostname has no protocol, slash or wildcard; it is a custom origin domain, not a path route. On a production deploy, Wrangler provisions the custom domain and Cloudflare manages its DNS record and certificate in the account's active `lowkey.tools` zone. The deployment credentials must have permission to manage that zone. If an existing CNAME or another hosting project owns the hostname, resolve that association when switching hosts.

`workers_dev: true` and `preview_urls: true` keep the Workers development hostname and version previews available, as in Billbook. Non-production builds upload a preview version without promoting it to the custom production domain. No live domain or DNS changes happen during a local build, preview or dry run. The canonical remains `https://streakfreak.lowkey.tools/`; retaining the same origin preserves IndexedDB data, while moving from a preview origin still needs JSON export/import.

Workers applies `_headers` to static responses and handles index aliases through `_redirects`. `assets.not_found_handling: "404-page"` preserves real missing-page responses instead of returning a successful app shell. `html_handling: "auto-trailing-slash"` serves the root index naturally; the explicit index aliases redirect permanently to `/`. The 404 document is noindex and is excluded from service-worker precaching. Redirect and error response details are managed by the static asset runtime; the app does not introduce a server handler. Keep the standard Workers asset caching and avoid a zone-wide Cache Everything rule that would override shell revalidation.

The local Workers HTTP checks cover headers, cache policies, routing and offline installation assets. Local checks and a deploy dry run do not publish a release or connect DNS. Verify production responses after deploying.

References: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [static headers](https://developers.cloudflare.com/workers/static-assets/headers/), [HTML routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/), [custom domains in Wrangler](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/#set-up-a-custom-domain-in-your-wrangler-configuration-file).

## Search, answer engines and attribution

`lib/site-content.json` is the shared source for the title, description, public product facts and FAQs. `app/page.tsx` renders the guide and JSON-LD on the server, passing the guide as children to the client tracker. This keeps the guide implementation out of the client JavaScript while making all answers and creator links readable in the initial HTML. No personal records enter generated HTML or discovery files.

- Canonical, Open Graph and Twitter URLs consistently identify `https://streakfreak.lowkey.tools/`. Social cards use `public/og-image.png`, a 1734 × 907 landscape image with only `by @shrinath_prabhu` as its maker credit. The image must be served from the canonical host. Twitter uses the large-image card. The artwork is excluded from offline installation downloads; the app icons still ship separately. See [the generation prompt](docs/og-image.md).
- JSON-LD describes the Streakfreak WebSite, WebApplication, WebPage and FAQPage at the canonical subdomain, with Lowkey Tools as its parent collection. Shrinath Prabhu and OwlEye Analytics retain their shared attribution IDs. The site name also matches Open Graph metadata. FAQ answers match visible copy. No ratings, endorsements or reviews are invented.
- OwlEye and Shrinath have visible contextual links, dedicated maker cards, footer credits and linked structured attribution. The maker section also links to @shrinath_prabhu on X. A single SuperFocus recommendation connects habits with making time for a focus session; its public copy and destination live in `lib/site-content.json` and also appear in `llms.txt`. These are normal followed links without tracking parameters.
- `scripts/build-discovery.mjs` generates `sitemap.xml`, `robots.txt` and `llms.txt` in `dist/client/` on every build. The sitemap lists only the canonical page; UI tabs, local history and aliases are not indexable pages. No speculative `lastmod`, `priority` or `changefreq` values are emitted.
- The wildcard robots rule allows compliant search and answer-engine crawlers to read public app information. IndexedDB records are not HTTP endpoints. `llms.txt` provides an optional product summary and official maker links; it is not an access control or a guaranteed indexing mechanism.
- The document has an English language tag, one H1, labeled navigation, a main landmark, a top-level footer, a skip link and a structured H2/H3 guide. Mobile uses the same public content and metadata. Narrow screens get single-column habit/template cards, large touch controls, scrollable heatmaps and readable form fields; zoom remains enabled.

The production deployment serves its own root `robots.txt`, `sitemap.xml` and `llms.txt`. The robots file points to `https://streakfreak.lowkey.tools/sitemap.xml`; the sitemap lists `https://streakfreak.lowkey.tools/` only. No hub crawl-file merging is needed. Submit the app's sitemap in the verified Search Console property after the domain is publicly available over HTTPS. Missing URLs must return 404, not the app shell.

DNS, public access, Search Console submission, Rich Results validation and real-device Web Vitals still require verification on that production host. The private Sites publication is not crawlable by public search engines. Standard SEO supports Google's generative search features; extra AI files or special markup are not required, and FAQ/app markup does not guarantee a rich result. References: [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features), [canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [root robots placement](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt), [llms.txt proposal](https://llmstxt.org/).

History calculations group entries once per update, memoize habit streaks and heatmap summaries, and reuse `Intl` date/number formatters. CSV exports reuse the same history grouping. This avoids scanning an entire large journal once for every habit and recomputing calendar labels when opening a dialog or choosing a day. Run the synthetic, non-browser benchmark with `node --experimental-strip-types scripts/benchmark-history.mjs`; its timings do not represent Lighthouse or Core Web Vitals scores.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
node --test tests/pwa.test.mjs tests/discovery.test.mjs tests/security.test.mjs
npm run test:workers
```

The tests exercise goal semantics, calendar/DST behavior, streak gaps, grouped history, backup validation, CSV injection escaping, IndexedDB transactions, goal snapshot preservation, import merges, and cascading deletion. Production tests verify the precache files, canonical/manifest paths, cache cleanup isolation, exact-path offline fallback, request filtering, static semantic landmarks, matching FAQ/schema facts, social metadata, creator links and crawler files. Security tests start the local static server and check actual response headers, every executable startup hash, resource caching, redirects, 404/405 behavior, HEAD requests, blocked internal files and matching Workers output. Production tests target the root deployment and verify that retired path URLs return 404. The Workers checks first dry-run the default root deploy command to ensure config discovery succeeds without setup or dependency changes, then use Wrangler to verify static headers, MIME types, index redirects, missing routes, ETag/304, HEAD, and every offline precache URL against actual local HTTP responses. Shadcn-generated files are excluded from the app’s lint scope; they are retained unmodified.

Optional WebMCP tools (`read_habit_progress`, `save_habit_check_in`) use the same local actions and are only registered if the browser provides `document.modelContext`. Their adapter contract is unit-tested; a live supported WebMCP browser was not available for integration verification. No browser interaction, visual, or device installation testing has been performed in this task.
