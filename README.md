# Folio mobile app

Native iOS and Android client for Folio, built with Expo (React Native) and TypeScript.
It is a second client of the existing Folio backend: same API, same users, same data as the web app.

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 57, Expo Router (file-based routing under `app/`) |
| Styling | NativeWind 4 (Tailwind class names on React Native components) |
| Data | TanStack Query + `openapi-fetch` client typed from the backend OpenAPI spec |
| Auth | Bearer JWT from `POST /api/v1/auth/login`; tokens in `expo-secure-store`; automatic refresh on 401 |
| i18n | i18next, locales `en` / `fr` / `vi` (device language, English fallback) |
| Quality | ESLint (expo config), TypeScript strict, Jest (`jest-expo`), GitHub Actions CI |

## Layout

```
app/                 Expo Router routes
  _layout.tsx        providers + session-guarded route groups
  (auth)/index.tsx   login screen
  (app)/index.tsx    home: signed-in user + projects list
src/
  api/client.ts      typed API client with Bearer + refresh middleware
  api/generated/     schema.d.ts generated from openapi/folio-openapi.json
  auth/              secure token storage + AuthProvider / useAuth
  config/env.ts      API base URL resolution
  i18n/              i18next setup + locale JSON
openapi/             snapshot of the backend OpenAPI spec used for type generation
```

## Setup

```bash
npm ci
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL if not using the local docker stack
npx expo prebuild      # generates ios/ and android/ (not committed)
npm run ios            # or: npm run android
```

Local backend: run the Folio docker compose stack from the parent workspace; the API listens on
`http://localhost:5000` (iOS simulator) / `http://10.0.2.2:5000` (Android emulator).
Production API: `https://folio.flowitup.com`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run ios` / `npm run android` | build and run the dev client on a simulator / emulator |
| `npm start` | Metro bundler only |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` | Jest |
| `npm run api:types` | regenerate `src/api/generated/schema.d.ts` from `openapi/folio-openapi.json` |

## Refreshing the API types

The backend serves its spec at `/openapi.json` (local stack, or production when `EXPOSE_DOCS=1`).
Replace `openapi/folio-openapi.json` with the new spec and run `npm run api:types`.
