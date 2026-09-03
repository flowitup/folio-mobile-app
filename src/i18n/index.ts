import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import vi from "./locales/vi.json";

// Same three locales as the web app; device language picks the default, English is the fallback.
export const SUPPORTED_LOCALES = ["en", "fr", "vi"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_STORAGE_KEY = "folio.locale";

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
  vi: { translation: vi },
} as const;

function asSupported(code: string | null | undefined): SupportedLocale | null {
  return code && (SUPPORTED_LOCALES as readonly string[]).includes(code)
    ? (code as SupportedLocale)
    : null;
}

function detectDeviceLocale(): SupportedLocale {
  return asSupported(getLocales()[0]?.languageCode) ?? "en";
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// A locale the user picked in Settings wins over the device language on later launches.
void SecureStore.getItemAsync(LOCALE_STORAGE_KEY)
  .then((stored) => {
    const locale = asSupported(stored);
    if (locale && locale !== i18n.language) return i18n.changeLanguage(locale);
  })
  .catch(() => undefined);

/** Switches the UI language and remembers the choice across launches. */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale).catch(
    () => undefined,
  );
}

export default i18n;
