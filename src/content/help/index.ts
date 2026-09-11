import { DEFAULT_LOCALE, type SupportedLocale } from "@/i18n";

import { helpCatalogueEn } from "./en";
import { helpCatalogueFr } from "./fr";
import { helpCatalogueVi } from "./vi";
import type { HelpCatalogue } from "./types";

const CATALOGUES: Record<SupportedLocale, HelpCatalogue> = {
  en: helpCatalogueEn,
  fr: helpCatalogueFr,
  vi: helpCatalogueVi,
};

/** The workflow guide for a locale, falling back to the default locale for anything unknown. */
export function getHelpCatalogue(locale: string): HelpCatalogue {
  return Object.hasOwn(CATALOGUES, locale)
    ? CATALOGUES[locale as SupportedLocale]
    : CATALOGUES[DEFAULT_LOCALE];
}

export type { HelpCatalogue, HelpTopic } from "./types";
