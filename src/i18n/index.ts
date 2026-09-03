import { getLocales } from "expo-localization";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import vi from "./locales/vi.json";

// Same three locales as the web app; device language picks the default, English is the fallback.
export const SUPPORTED_LOCALES = ["en", "fr", "vi"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
  vi: { translation: vi },
} as const;

function detectDeviceLocale(): SupportedLocale {
  const code = getLocales()[0]?.languageCode ?? "en";
  return (SUPPORTED_LOCALES as readonly string[]).includes(code)
    ? (code as SupportedLocale)
    : "en";
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
