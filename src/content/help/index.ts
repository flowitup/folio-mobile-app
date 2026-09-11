import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/i18n";

import { helpCatalogueEn, helpChromeEn } from "./en";
import { helpCatalogueFr, helpChromeFr } from "./fr";
import { helpCatalogueVi, helpChromeVi } from "./vi";
import type { HelpCatalogue, HelpChrome } from "./types";

const CATALOGUES: Record<SupportedLocale, HelpCatalogue> = {
  en: helpCatalogueEn,
  fr: helpCatalogueFr,
  vi: helpCatalogueVi,
};

const CHROME: Record<SupportedLocale, HelpChrome> = {
  en: helpChromeEn,
  fr: helpChromeFr,
  vi: helpChromeVi,
};

/** The languages the guide can be read in — the reader picks one independently of the app's. */
export const HELP_LOCALES = SUPPORTED_LOCALES;

/** How each language names itself, so the picker reads the same whatever language you are in. */
export const HELP_LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  fr: "Français",
  vi: "Tiếng Việt",
};

/** The reader's chosen guide language, falling back to the app's and then the default. */
export function resolveHelpLocale(locale: string): SupportedLocale {
  return Object.hasOwn(CATALOGUES, locale)
    ? (locale as SupportedLocale)
    : DEFAULT_LOCALE;
}

/** The workflow guide in a given language. */
export function getHelpCatalogue(locale: string): HelpCatalogue {
  return CATALOGUES[resolveHelpLocale(locale)];
}

/** The panel's own labels in a given language. */
export function getHelpChrome(locale: string): HelpChrome {
  return CHROME[resolveHelpLocale(locale)];
}

export type { HelpCatalogue, HelpChrome, HelpTopic } from "./types";
