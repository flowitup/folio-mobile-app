# Folio mobile app

Native iOS and Android client for Folio, built with Expo (React Native) and TypeScript.
It is a second client of the existing Folio backend: same API, same users, same data as the web app.

## Stack

| Layer            | Choice                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Expo SDK 57 / React Native 0.86, Expo Router (file-based routing under `app/`, typed routes deliberately off)                                           |
| Styling          | NativeWind 4 + Tailwind 3.4; design tokens as CSS variables in `global.css` (light + dark via `prefers-color-scheme`) mirrored in `src/theme/tokens.ts` |
| Fonts            | Inter (UI), Fraunces (titles), JetBrains Mono (numbers) through `@expo-google-fonts/*`; Feather icons through `@expo/vector-icons`                      |
| Data             | TanStack Query 5 + `openapi-fetch` client typed from the backend OpenAPI spec                                                                           |
| Auth             | Bearer JWT from `POST /api/v1/auth/login`; tokens in `expo-secure-store`; single-flight refresh on 401                                                  |
| i18n             | i18next, locales `en` / `fr` / `vi` (device language, English fallback); a Jest test enforces key parity                                                |
| Sheets / pickers | `@gorhom/bottom-sheet`, `@react-native-community/datetimepicker`, expo-image-picker / expo-file-system for uploads                                      |
| Quality          | ESLint 9 (expo config), TypeScript strict, Jest (`jest-expo` + RNTL 14), GitHub Actions CI (`lint`, `type-check`, `test`)                               |

## App shell (design 2a, "project first")

The signed-in app is built around one selected project (`src/features/projects/selected-project.tsx`,
persisted in secure storage). Four project tabs sit in a floating tab bar; everything else opens from the
top bar or the menu tab as sheets or hidden stack routes.

| Surface                                                       | Route / component                                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Overview, Expenses, Labor, Planning tabs                      | `app/(app)/(tabs)/{index,expenses,labor,planning}.tsx`                                               |
| Top bar: project switcher, notifications bell, account avatar | `src/components/shell/project-top-bar.tsx` + `*-sheet.tsx`                                           |
| Menu tab (billing, library, project sections, settings)       | `src/components/shell/menu-sheet.tsx`                                                                |
| Hidden stack routes (no tab entry)                            | `billing/*`, `library/*`, `settings/*`, `projects/[id]/*` under `app/(app)/(tabs)/`                  |
| Team chat overlay                                             | `app/(app)/chat.tsx` (slides in from the right), floating button `src/components/shell/chat-fab.tsx` |
| Invitation deep link                                          | `app/accept-invite/[token].tsx`                                                                      |

## Team chat

Chat is a backend feature flag: the app calls `GET /api/v1/features` once per session and shows the chat
button only when `chat` is `true` (the backend sets it from its `FEATURE_CHAT` environment variable;
chat routes answer 404 when it is off).

- Channels are virtual: one per company (`company:<uuid>`) and one per project (`project:<uuid>`);
  membership follows company access and project membership.
- Messages are text and/or one image (jpeg / png / webp, ≤ 10 MiB) sent as JSON or multipart.
- Sync is polling, not push: the open channel is re-fetched every 5 s, the channel list (unread counts,
  button badge) every 30 s (`src/features/chat/chat-api.ts`).
- Seen receipts: every member carries `last_read_at`; `src/lib/chat/seen-by.ts` puts each reader's
  avatar under the newest message at or before their marker. The screen marks the channel read on open,
  on send, and when a new incoming message arrives while it is open.
- Images load through `AuthedImage` (Bearer header, with an authenticated-fetch fallback).

## Layout

```
app/                        Expo Router routes
  _layout.tsx               providers (query, auth, i18n, fonts) + session-guarded groups
  (auth)/index.tsx          login
  (app)/_layout.tsx         stack: tabs + chat overlay
  (app)/chat.tsx            team chat
  (app)/(tabs)/_layout.tsx  floating tab bar, shell sheets, chat button, hidden routes
  (app)/(tabs)/…            project tabs, billing/, library/, settings/, projects/[id]/<section>
  accept-invite/[token].tsx
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
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL if not using the local docker stack
npx expo prebuild      # generates ios/ and android/ (not committed)
npm run ios            # or: npm run android
```

Local backend: run the Folio docker compose stack from the parent workspace; the API listens on
`http://localhost:5000` (iOS simulator) / `http://10.0.2.2:5000` (Android emulator). Set `FEATURE_CHAT=1`
on the API container to work on chat. Production API: `https://folio.flowitup.com`.

Once the dev client is installed, later runs only need Metro (`npm start`) and opening
`folio://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081` (Android: `10.0.2.2`).

## Scripts

| Command                           | Purpose                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `npm run ios` / `npm run android` | build and run the dev client on a simulator / emulator                       |
| `npm start`                       | Metro bundler only                                                           |
| `npm run lint`                    | ESLint                                                                       |
| `npm run type-check`              | `tsc --noEmit`                                                               |
| `npm test`                        | Jest                                                                         |
| `npm run api:types`               | regenerate `src/api/generated/schema.d.ts` from `openapi/folio-openapi.json` |

Before every commit: `npx prettier --write`, `npm run lint`, `npm run type-check`, `npx jest --ci` —
all four green, zero warnings (CI runs the last three).

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
