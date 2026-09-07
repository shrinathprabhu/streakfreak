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

Serve `dist/client/` on any HTTPS static host. `npm start` is only a local static file preview. `dist/server/` contains build intermediates and is not deployed. The app does not require a Worker, database service, API keys, or environment secrets.

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

The generated service worker precaches the exact built HTML, scripts, styles, and icons. It only handles GET requests for the app’s own origin and scope. Offline navigation returns the precached app shell; IndexedDB remains separate from the shell cache. New releases install a new version and activate once existing tabs close. Obsolete Streakfreak shell caches are removed without clearing habit data. No production service worker is registered in development.

PWA installation and offline caching need HTTPS (localhost works for development). See [MDN’s service-worker guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) and [manifest scope documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope).

## Domains and canonical URL

The canonical is always `https://lowkey.tools/streakfreak`.

For `streakfreak.lowkey.tools`, deploy the default build at the host root. For hosting within the existing Lowkey Tools site, build with a path prefix:

```sh
NEXT_PUBLIC_BASE_PATH=/streakfreak npm run build
NEXT_PUBLIC_BASE_PATH=/streakfreak npm start
```

Mount `dist/client/` at `/streakfreak/` and **serve its index at `/streakfreak` with HTTP 200**. Redirect `/streakfreak/` and `/streakfreak/index.html` to that exact canonical entry URL at the production host. Do not redirect the canonical URL to the trailing-slash alias. The local preview implements the slash redirect and canonical 200 response. App assets retain the `/streakfreak/` prefix.

The subpath build gives the manifest an explicit `/streakfreak` ID, start URL and scope. The worker registers at the same scope with `Service-Worker-Allowed: /streakfreak`, covering the exact canonical page. Browser scopes use prefix matching, so the worker also checks path boundaries and never intercepts sibling applications or unknown page routes. Configure the emitted `Service-Worker-Allowed` header when deploying; do not deploy a conflicting app under a `/streakfreak...` prefix. Root builds retain the portable `./` manifest values.

Serve JavaScript with its proper MIME type and `sw.js` without a long-lived immutable cache. The build emits Cloudflare-compatible `_headers`; the Vercel build and local static preview apply the same policies. Hashed framework assets can be cached for a year; HTML and the worker must revalidate. Enable the host’s Brotli/gzip compression.

Custom DNS and the existing `lowkey.tools` deployment are external configuration. A private Sites preview is separate from the no-login application and does not connect those domains automatically.

## Security headers, caching and Vercel

`scripts/hosting-rules.mjs` is the shared policy source for Cloudflare `_headers`, the local static server and Vercel Build Output API routes. Security policy changes also change the PWA cache version so old cached documents can receive the new policy.

- CSP allows same-origin resources and exact SHA-256 hashes of the exported startup scripts. It disallows arbitrary inline JavaScript, inline event attributes, `eval`, object embeds, base tags, form navigation and framing. Inline **styles** remain allowed because React and Base UI use them for sizing and positioning. Font loading, local file import, Blob downloads and service-worker requests remain supported. JSON-LD is an inert data block and does not need executable script permission.
- HSTS lasts one year and applies to the serving host, without a preload registration or a policy imposed on unrelated subdomains. Framing is also denied through `X-Frame-Options`; MIME sniffing is disabled. The policy includes `no-referrer`, same-origin opener/resource protection, disabled DNS prefetch, and disabled camera, microphone, location, payment and USB permissions.
- The exported 404 keeps its static content but discards unused hydration scripts, canonical metadata and conflicting index directives. Vercel and the local server return 404 with `no-store` and `X-Robots-Tag: noindex` for missing pages. Unsupported write methods receive 405.
- Vercel and the local server expose only the public static asset list, excluding dotfiles, host configuration, source maps and the internal client-entry manifest. They have no catch-all rewrite to a successful app page.

| Resource                                       | Browser cache policy                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| App HTML, RSC payload, web manifest            | `public, max-age=0, must-revalidate`                                                   |
| Service worker                                 | `no-cache, max-age=0, must-revalidate` plus the correct `Service-Worker-Allowed` scope |
| Hashed `/_next/static/` scripts, CSS and fonts | `public, max-age=31536000, immutable`                                                  |
| Unversioned icons and favicon                  | `public, max-age=86400`                                                                |
| Sitemap, robots, llms and font license         | `public, max-age=3600`                                                                 |
| Missing pages and rejected writes              | `no-store`                                                                             |

The root `vercel.json` selects the static build rather than Next.js server deployment. On Vercel, connect this repository and keep its declared build command, `npm run build:vercel`. It runs the normal static export and creates `.vercel/output/static/` plus `.vercel/output/config.json` with fresh CSP hashes, headers, canonical-path redirects and real 404 routes. Do not set a conflicting output-directory override or edit the generated rules manually. This produces no Vercel Functions or server-side data store.

Use the default build for a standalone host such as `streakfreak.lowkey.tools`. Set `NEXT_PUBLIC_BASE_PATH=/streakfreak` for the canonical subpath: the Vercel adapter mounts files under that path, serves `/streakfreak` with 200, and redirects its trailing-slash and index aliases. If the existing Lowkey Tools hub owns the domain, its project still needs to route this path to the app and merge root crawl files; this repository does not overwrite that project. The subdomain remains usable until a separate domain redirect is configured, preserving access to users’ origin-specific exports.

Vercel settings are prepared in source and generated output; a live Vercel deployment, DNS, account firewall settings and platform-added scripts have not been verified here. The current publication uses Sites. Direct authenticated HTTP inspection of that preview showed that its host does **not** apply the app’s `_headers` file: it returns its own revalidation cache policy and omits the custom security headers. The configuration therefore must not be described as enforced on the Sites preview. The local server’s responses and generated Vercel rules are verified; final production headers still need verification after deployment on Vercel or another compatible host. The build rejects an oversized CSP instead of weakening it to allow arbitrary scripts. References: [Vercel Build Output API](https://vercel.com/docs/build-output-api/configuration), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [CSP script hashes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src), [Cloudflare header rules and limits](https://developers.cloudflare.com/workers/static-assets/headers/).

## Search, answer engines and attribution

`lib/site-content.json` is the shared source for the title, description, public product facts and FAQs. `app/page.tsx` renders the guide and JSON-LD on the server, passing the guide as children to the client tracker. This keeps the guide implementation out of the client JavaScript while making all answers and creator links readable in the initial HTML. No personal records enter generated HTML or discovery files.

- Canonical, Open Graph and Twitter URLs consistently identify `https://lowkey.tools/streakfreak`. Social cards use the existing 512px app icon, which must be served from the canonical host.
- JSON-LD describes the WebApplication, WebPage, FAQPage, Lowkey Tools website, Shrinath Prabhu and OwlEye Analytics, with stable entity IDs matching the other Lowkey Tools sites. FAQ answers match visible copy. No ratings, endorsements or reviews are invented.
- OwlEye and Shrinath have visible contextual links, dedicated maker cards, footer credits and linked structured attribution. These are normal followed links without tracking parameters.
- `scripts/build-discovery.mjs` generates `sitemap.xml`, `robots.txt` and `llms.txt` in `dist/client/` on every build. The sitemap lists only the canonical page; UI tabs, local history and aliases are not indexable pages. No speculative `lastmod`, `priority` or `changefreq` values are emitted.
- The wildcard robots rule allows compliant search and answer-engine crawlers to read public app information. IndexedDB records are not HTTP endpoints. `llms.txt` provides an optional product summary and official maker links; it is not an access control or a guaranteed indexing mechanism.
- The document has an English language tag, one H1, labeled navigation, a main landmark, a top-level footer, a skip link and a structured H2/H3 guide. Mobile uses the same public content and metadata. Narrow screens get single-column habit/template cards, large touch controls, scrollable heatmaps and readable form fields; zoom remains enabled.

For the **canonical production deployment**, the host must serve the canonical page and assets publicly over HTTPS, merge `Sitemap: https://lowkey.tools/streakfreak/sitemap.xml` into the existing **`https://lowkey.tools/robots.txt`**, and add the canonical URL to the hub’s root sitemap (or submit the app sitemap in a verified Search Console property). A robots file inside `/streakfreak/` does not control crawling of the origin. Link the app’s `/streakfreak/llms.txt` from the hub’s existing root `/llms.txt`; do not overwrite files used by the other tools. Prefer a permanent redirect from `streakfreak.lowkey.tools` to the canonical URL once users have exported any origin-specific data. Missing URLs must return 404, not the app shell.

DNS, hub routing/root files, public access, Search Console submission, Rich Results validation and real-device Web Vitals still require verification on that production host. The private Sites publication is not crawlable by public search engines. Standard SEO supports Google’s generative search features; extra AI files or special markup are not required, and FAQ/app markup does not guarantee a rich result. References: [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features), [canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [root robots placement](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt), [llms.txt proposal](https://llmstxt.org/).

History calculations group entries once per update, memoize habit streaks and heatmap summaries, and reuse `Intl` date/number formatters. CSV exports reuse the same history grouping. This avoids scanning an entire large journal once for every habit and recomputing calendar labels when opening a dialog or choosing a day. Run the synthetic, non-browser benchmark with `node --experimental-strip-types scripts/benchmark-history.mjs`; its timings do not represent Lighthouse or Core Web Vitals scores.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
node --test tests/pwa.test.mjs tests/discovery.test.mjs
node scripts/build-vercel.mjs
node --test tests/security.test.mjs
```

The tests exercise goal semantics, calendar/DST behavior, streak gaps, grouped history, backup validation, CSV injection escaping, IndexedDB transactions, goal snapshot preservation, import merges, and cascading deletion. Production tests verify the precache files, canonical/manifest paths, cache cleanup isolation, exact-path offline fallback, request filtering, static semantic landmarks, matching FAQ/schema facts, social metadata, creator links and crawler files. Security tests start the local static server and check actual response headers, every executable startup hash, resource caching, redirects, 404/405 behavior, HEAD requests, blocked internal files and matching Vercel output. Run production tests against both root and `NEXT_PUBLIC_BASE_PATH=/streakfreak` builds, passing the same environment variable to the Vercel adapter and security tests. Shadcn-generated files are excluded from the app’s lint scope; they are retained unmodified.

Optional WebMCP tools (`read_habit_progress`, `save_habit_check_in`) use the same local actions and are only registered if the browser provides `document.modelContext`. Their adapter contract is unit-tested; a live supported WebMCP browser was not available for integration verification. No browser interaction, visual, or device installation testing has been performed in this task.
