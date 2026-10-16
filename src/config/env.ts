import { Platform } from "react-native";

// Android emulators reach the host machine through 10.0.2.2; iOS simulators share localhost.
const localApiFallback =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

/** Base URL of the Folio backend API, without trailing slash. */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? localApiFallback;

/**
 * Base URL of the Folio web app (legal pages, invitation links), without trailing slash. In
 * production it shares the API's origin; a local API on :5000 pairs with the web app on :3000.
 */
export const WEB_BASE_URL: string =
  process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/+$/, "") ??
  API_BASE_URL.replace(/:5000$/, ":3000");
