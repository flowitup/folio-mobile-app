# Folio mobile app

Native iOS and Android client for Folio, built with Expo (React Native) and TypeScript.
It is a second client of the existing Folio backend: same API, same users, same data as the web app.

## Stack

| Layer            | Choice                                                                                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Expo SDK 57 / React Native 0.86, Expo Router (file-based routing under `app/`, typed routes deliberately off)                                                                                                                                             |
| Styling          | NativeWind 4 + Tailwind 3.4; design tokens as CSS variables in `global.css` (light + dark via `prefers-color-scheme`) mirrored in `src/theme/tokens.ts`                                                                                                   |
| Fonts            | Inter (UI), Fraunces (titles), JetBrains Mono (numbers) through `@expo-google-fonts/*`; Feather icons through `@expo/vector-icons`                                                                                                                        |
| Data             | TanStack Query 5 + `openapi-fetch` client typed from the backend OpenAPI spec                                                                                                                                                                             |
| Auth             | Phone + SMS one-time code (`POST /api/v1/auth/otp/request` → `/otp/verify`; sign-up via `/auth/signup/request` → `/signup/verify`); `access_token` / `refresh_token` in `expo-secure-store`; single-flight refresh on 401 via `POST /api/v1/auth/refresh` |
| i18n             | i18next, locales `en` / `fr` / `vi`; starts in Vietnamese whatever the device language, until the user picks another in Settings (remembered in secure storage); missing keys fall back to Vietnamese; Jest tests pin the default and enforce key parity  |
| Sheets / pickers | `@gorhom/bottom-sheet`, `@react-native-community/datetimepicker`, expo-image-picker / expo-file-system for uploads                                                                                                                                        |
| Files            | In-app PDF viewer (`app/(app)/pdf-viewer.tsx`) — native on iOS, bundled pdf.js (`assets/pdfjs/`, `npm run pdfjs:vendor`) on Android so it works offline                                                                                                   |
| Quality          | ESLint 9 (expo config), TypeScript strict, Jest (`jest-expo` + RNTL 14), GitHub Actions CI/CD (see Releases below)                                                                                                                                        |

## App shell (design 2a, "project first")

The signed-in app is built around one selected project (`src/features/projects/selected-project.tsx`,
persisted in secure storage). Four project tabs sit in a floating tab bar; everything else opens from the
top bar or the menu tab as sheets or hidden stack routes. A project member without `project:manage_labor`
gets the worker shell instead — Attendance / Salary / Profile / Planning tabs and no Menu — but only once a
manager has linked them to one of the project's worker rows; an unlinked member keeps the normal shell, since
they would otherwise have no attendance, salary or profile to show (`src/lib/labor/worker-mode.ts`).

The Overview and Expenses tabs and the invoice detail follow design 1b ("Bảng mực"): a fixed ink header, a
scrolling ink hero with the headline figure (`InkFigure`, ring gauge drawn with Views in
`src/components/ui/ring-gauge.tsx`) and quick actions, then a paper sheet with 24px rounded corners
(`src/components/ui/ink-sheet-screen.tsx`). The ink block always uses the dark palette (`INK_BLOCK` in
`src/theme/tokens.ts`, mirrored as `ink-block*` tailwind colors) so it stays ink in light mode.

| Surface                                                                                   | Route / component                                                                                               |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Overview, Expenses, Labor, Planning tabs                                                  | `app/(app)/(tabs)/{index,expenses,labor,planning}.tsx`                                                          |
| Top bar: project switcher, help mark (workflow guide), notifications bell, account avatar | `src/components/shell/project-top-bar.tsx` + `*-sheet.tsx`                                                      |
| Menu tab (billing, library, inventory, company members for admins, project sections…)     | `src/components/shell/menu-sheet.tsx`                                                                           |
| Hidden stack routes (no tab entry)                                                        | `billing/*`, `library/*`, `inventory/*`, `settings/*`, `company/*`, `projects/[id]/*` under `app/(app)/(tabs)/` |
| Team chat overlay                                                                         | `app/(app)/chat.tsx` (slides in from the right), floating button `src/components/shell/chat-fab.tsx`            |
| Onboarding (no company / no project assignment yet)                                       | `app/(app)/onboarding{,-create,-waiting}.tsx`, `app/(app)/join-company.tsx`                                     |
| Invitation deep link                                                                      | `app/accept-invite/[token].tsx`                                                                                 |

## Team chat

Chat and the Folio Assistant are separate backend feature flags, read once per session from
`GET /api/v1/features` (`src/features/chat/chat-api.ts`, `useChatEnabled` / `useAssistantEnabled`):

- `chat` (backend `FEATURE_CHAT`) gates the chat button; chat routes answer 404 when it is off.
- `assistant` (backend `FEATURE_ASSISTANT` plus its two core provider keys) gates the assistant
  controls — the `@folio` composer suggestion, the "Ask again" reply button and the choice buttons under
  an assistant message — whose routes answer 404 when it is off.

How chat behaves:

- Channels are virtual: one per company (`company:<uuid>`), one per project (`project:<uuid>`), and one
  per company for admins (`admin:<uuid>`, company admins + platform ops, shown with a lock chip);
  membership follows company access and project/admin standing.
- Messages are text and/or one attachment — an image (jpeg / png / webp) or a voice recording
  (aac/m4a family, 5 min max) — ≤ 10 MiB, sent as JSON (text-only) or multipart.
- The assistant answers inside those same channels, addressed with an `@folio` mention or a reply to one
  of its messages; its replies can carry a card, a set of choice buttons, or a background-job status
  (`src/lib/chat/assistant.ts`).
- Chat data is polled, not pushed: the open channel is re-fetched every 5 s; the channel chips inside
  chat refresh every 15 s, and the floating button's unread badge every 30 s while a project tab is
  showing (`src/features/chat/chat-api.ts`). New messages also trigger a device notification that opens
  the channel when tapped; the thread itself still arrives by polling.
- Seen receipts: every member carries `last_read_at`; `src/lib/chat/seen-by.ts` puts each reader's
  avatar under the newest message at or before their marker. The screen marks the channel read on open,
  on send, and when a new incoming message arrives while it is open.
- Images load through `AuthedImage` (Bearer header, with an authenticated-fetch fallback).

## Equipment inventory

Menu → "Kho thiết bị" lists the company's tools and machines (drills, screwdrivers, ladders…):
how many there are, whether each is **working** or **damaged**, and where it is — a company
**warehouse** (name + address) or **on site** (a project). One row is one batch of identical
things in one place and one condition; the screen groups rows by place, sums units on the tiles,
and filters by place / condition / text (`src/lib/inventory/inventory-helpers.ts`, unit-tested).

| Surface                             | Route / component                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| List, summary, filters, create/edit | `app/(app)/(tabs)/inventory/index.tsx` + `src/features/inventory/inventory-item-*` |
| Warehouses (name, address, units)   | `app/(app)/(tabs)/inventory/warehouses.tsx` + `warehouse-form-sheet.tsx`           |
| Hooks and query keys                | `src/features/inventory/inventory-api.ts`                                          |

### Backend contract

`/api/v1/inventory/*` (tag `inventory` in `openapi/folio-openapi.json`), company-scoped exactly like
`/api/v1/bibliotheque`: `?company_id=` on reads (caller's primary company when absent), `company_id` in
the body on creates, membership checked in the use-case, writes gated by an `inventory:manage` permission
(same tiers as `bibliotheque:manage`). The response bodies are untyped in the spec, like the library's, so
`src/features/inventory/inventory-types.ts` hand-mirrors the shapes below.

| Method & path                                 | Body / query                                                                                                                | Answer                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `GET /inventory/warehouses`                   | `?company_id`                                                                                                               | `{ items: Warehouse[] }`                  |
| `POST /inventory/warehouses`                  | `{ company_id, name, address? }`                                                                                            | `201 Warehouse`                           |
| `PATCH /inventory/warehouses/{warehouse_id}`  | `{ name?, address? }`                                                                                                       | `Warehouse`                               |
| `DELETE /inventory/warehouses/{warehouse_id}` | —                                                                                                                           | `204`; `409` while items are stored there |
| `GET /inventory/items`                        | `?company_id` (+ optional `location_type`, `warehouse_id`, `project_id`, `condition`, `q`; the app filters locally)         | `{ items: InventoryItem[], total }`       |
| `POST /inventory/items`                       | `{ company_id, name, quantity, condition, location_type, warehouse_id?, project_id?, category?, reference?, description? }` | `201 InventoryItem`                       |
| `GET /inventory/items/{item_id}`              | —                                                                                                                           | `InventoryItem`                           |
| `PATCH /inventory/items/{item_id}`            | any subset of the create body (minus `company_id`); absent key = unchanged, `null` = cleared                                | `InventoryItem`                           |
| `DELETE /inventory/items/{item_id}`           | —                                                                                                                           | `204`                                     |

`Warehouse`: `id, company_id, name, address | null, created_at, updated_at`.
`InventoryItem`: `id, company_id, name, category | null` (`power_tool | hand_tool | measuring | access | safety | machine | other`),
`reference | null, description | null, quantity` (integer ≥ 0), `condition` (`working | damaged`),
`location_type` (`warehouse | site`), `warehouse_id | null` (required when `warehouse`), `project_id | null`
(required when `site`; must belong to the company), `created_at, updated_at`.

## Layout

```
app/                        Expo Router routes
  _layout.tsx               providers (query, auth, i18n, fonts) + session-guarded groups
  (auth)/{index,signup}.tsx login, phone sign-up
  (app)/_layout.tsx         stack: tabs, onboarding, chat overlay, PDF viewer
  (app)/onboarding*.tsx     no-company / no-project-assignment gates
  (app)/join-company.tsx    join by code (onboarding step, or from Settings)
  (app)/chat.tsx            team chat
  (app)/pdf-viewer.tsx      in-app PDF viewer (documents, attachments, billing, exports)
  (app)/(tabs)/_layout.tsx  floating tab bar, shell sheets, chat button, hidden routes
  (app)/(tabs)/…            project tabs, billing/, company/, library/, inventory/, settings/, projects/[id]/<section>
  accept-invite/[token].tsx
assets/pdfjs/               vendored pdf.js for the Android PDF viewer (`npm run pdfjs:vendor`)
src/
  api/                      client.ts (typed client + refresh middleware), authed-fetch.ts, generated/schema.d.ts
  auth/                     secure token storage, AuthProvider / useAuth
  components/shell/         top bar, floating tab bar, sheets, chat button, shell context
  components/ui/            primitives: button, input, select, sheet, avatar, chip, icon, toast, pickers…
  features/<domain>/        <domain>-api.ts (TanStack hooks) + screens/sheets/cards for that domain
  lib/                      pure helpers with unit tests (format, files, query, chat, labor, billing…)
  theme/tokens.ts           design tokens (light/dark), worker palette, avatar initials
  i18n/                     i18next setup + locales/{en,fr,vi}.json
  __tests__/                Jest unit tests
openapi/folio-openapi.json  snapshot of the backend OpenAPI spec used for type generation
```

## Setup

```bash
npm ci                 # .npmrc sets legacy-peer-deps
cp .env.example .env   # only needed to target a backend other than your local one
npx expo prebuild      # generates ios/ and android/ (not committed)
npm run ios            # or: npm run android
```

`prebuild` copies `assets/` into `ios/` and `android/` once, at generation time — `npm run ios` /
`npm run android` do not re-sync it. After any change to the launcher icon or the splash screen —
the asset files, their `app.json` paths, or the `expo-splash-screen` plugin block — re-run
`npx expo prebuild -p <platform> --clean`; `npm run icons:check` reports when you have not.

Local backend: run [flowitup/folio-back-end](https://github.com/flowitup/folio-back-end) on port 5000
and leave `EXPO_PUBLIC_API_BASE_URL` unset — the app picks `http://localhost:5000` on the iOS simulator
and `http://10.0.2.2:5000` on the Android emulator itself (`src/config/env.ts`). Chat needs
`FEATURE_CHAT=1` on the API: put it in folio-back-end's `.env` when running `uv run flask run`, or add
it to the `api` service's environment when using its Docker setup (its `docker-compose.yml` doesn't
pass it through). The assistant also needs `FEATURE_ASSISTANT=1`, `DEEPSEEK_API_KEY` and
`TYPESAFE_API_KEY`, plus the backend's RQ worker running to answer. Production API:
`https://folio.flowitup.com`.

`expo-dev-client` is not a dependency, so there is no dev-client launcher or
`folio://expo-development-client` deep link. `npm run ios` / `npm run android` build a plain debug
build that loads its JS from Metro on port 8081 at launch; after the first build, later runs only need
Metro (`npm start`) and the installed app opened again. If the Android emulator does not pick up Metro, run
`adb reverse tcp:8081 tcp:8081` (or confirm it resolves `10.0.2.2:8081`). The debug build loads whatever
Metro owns port 8081, so stop other checkouts' Metro first. After a native dependency or config-plugin
change, rebuild the binary (`npm run android:check-apk` tells you when the Android one is stale).

## Scripts

| Command                           | Purpose                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `npm run ios` / `npm run android` | build a debug binary and launch it on a simulator / emulator                   |
| `npm start`                       | Metro bundler only                                                             |
| `npm run lint`                    | ESLint                                                                         |
| `npm run type-check`              | `tsc --noEmit`                                                                 |
| `npm test`                        | Jest                                                                           |
| `npm run api:types`               | regenerate `src/api/generated/schema.d.ts` from `openapi/folio-openapi.json`   |
| `npm run icons:check`             | flags `ios/` / `android/` still holding a stale launcher icon or splash        |
| `npm run android:check-apk`       | flags a built debug APK left stale by a new native dependency or config plugin |
| `npm run pdfjs:vendor`            | refreshes the bundled pdf.js under `assets/pdfjs/` from the pinned version     |

Before every commit: `npx prettier --write`, `npm run lint`, `npm run type-check`, `npx jest --ci` —
all four green, zero warnings (CI runs the last three).

## Releases (CI/CD)

`.github/workflows/ci.yml` mirrors flowitup/folio-front-end's:

- **Pull request to `master`** — the `version-bump` job reads the PR labels and commits the bump to
  `package.json`, `package-lock.json` and `app.json` (`expo.version`) on the PR branch:
  `version:major` / `version:minor` / `version:patch` (default when unlabeled) / `version:none` (no bump,
  no release). Then `lint`, `type-check` and `test` run against the bumped commit.
- **Push to `master`** (squash merge) — the `release` job derives the next version from the highest
  existing `v*` tag plus the merged PR's label (not from `package.json`), tags it and publishes a GitHub
  Release with generated notes. `version:none` skips the release.

App binaries are not built by CI — release builds are cut separately (no `eas.json` is committed).

## Refreshing the API types

The backend serves its spec at `/openapi.json` (local stack, or production when `EXPOSE_DOCS=1`).
Replace `openapi/folio-openapi.json` with the new spec and run `npm run api:types`.

## Conventions

- One feature module per backend domain: `src/features/<domain>/<domain>-api.ts` owns the query keys
  and hooks (`useApiMutation` from `src/lib/query` handles toasts + invalidation); screens stay thin.
- Pure logic goes to `src/lib/` with a unit test; UI is verified on the iOS simulator and the Android
  emulator against the local stack before merging.
- Every user-facing string exists in all three locale files (`src/__tests__` parity test).
- Money and dates go through `src/lib/format`; never format them inline.
