import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json plus what depends on the build: plain-HTTP traffic (Android
 * usesCleartextTraffic, iOS local networking) is allowed only for a build that
 * talks to a plain-http API — a dev build against the local API, where
 * EXPO_PUBLIC_API_BASE_URL is unset (src/config/env.ts falls back to
 * localhost) or http://. A release build points at the https API and ships
 * without it. APP_VARIANT=development forces it on.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  const cleartext =
    process.env.APP_VARIANT === "development" || !apiUrl.startsWith("https://");
  if (!cleartext) return config as ExpoConfig;
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
    android: { ...config.android, usesCleartextTraffic: true },
  } as ExpoConfig;
};
