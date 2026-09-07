# Streakfreak

A frontend-only, installable habit tracker. No login, analytics, backend, subscription, or cloud habit storage. The UI uses React 19, TypeScript, Vinext’s static export, Base UI/Shadcn primitives, Lucide icons, and plain CSS with Tailwind utilities.

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
- Current and best streaks, both across the journal and per habit.
- Edit/delete habits, update/clear check-ins, and confirm permanent habit deletion.
- Complete JSON backups, CSV exports, and validated, atomic JSON merge imports.
- Offline shell, installable manifest, PNG/maskable/Apple icons, installation guidance, and optional persistent browser storage.
- Accessible dialogs, labeled inputs, touch layouts, responsive grids, reduced-motion support, and visible save errors.

## Data and streak semantics

IndexedDB database `streakfreak`, version 1:

| Store | Key | Contents |
| --- | --- | --- |
| `habits` | `id` | name, description, unit, target, direction, icon, color, startDate |
| `entries` | `habitId:YYYY-MM-DD` | habitId, local date, value, target snapshot, direction snapshot, updatedAt |
| `meta` | string | idempotent initialization flag |

`direction` is `atLeast` or `atMost`. An absent entry never completes a goal, even for a maximum limit. An explicitly logged zero can complete a limit. Habit targets are user-defined presets, not health recommendations.

Every entry snapshots its goal and direction at its first save. Editing a habit affects newly created entries; updating an existing entry retains its original goal. Start-date edits cannot strand existing entries. All writes resolve only after the IndexedDB transaction commits; a failed transaction does not produce a success message. BroadcastChannel refreshes other open tabs.

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

Mount `dist/client/` at `/streakfreak/` and redirect `/streakfreak` to `/streakfreak/`. The build uses that prefix for assets, manifest links, service-worker URL/scope, and the home link. The manifest’s relative URLs keep installation within the correct scope. Serve JavaScript with its proper MIME type and `sw.js` without a long-lived immutable cache. Cloudflare-compatible headers are emitted in `_headers`; configure equivalent headers on other hosts.

Custom DNS and the existing `lowkey.tools` deployment are external configuration. A private Sites preview is separate from the no-login application and does not connect those domains automatically.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
node --test tests/pwa.test.mjs
```

The tests exercise goal semantics, calendar/DST behavior, streak gaps, backup validation, CSV injection escaping, IndexedDB transactions, goal snapshot preservation, import merges, and cascading deletion. Production tests verify the precache files, canonical/manifest paths, cache cleanup isolation, offline fallback, and request filtering. Shadcn-generated files are excluded from the app’s lint scope; they are retained unmodified.

Optional WebMCP tools (`read_habit_progress`, `save_habit_check_in`) use the same local actions and are only registered if the browser provides `document.modelContext`. Their adapter contract is unit-tested; a live supported WebMCP browser was not available for integration verification. No browser interaction, visual, or device installation testing has been performed in this task.
