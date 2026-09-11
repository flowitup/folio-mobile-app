/**
 * The workflow guide lives in typed modules rather than `src/i18n/locales/*.json`, so the
 * global locale-parity suite does not cover it. These assertions take its place: a locale
 * cannot quietly lose a topic, drop a step, or ship an empty field.
 */

import { helpCatalogueEn, helpChromeEn } from "@/content/help/en";
import { helpCatalogueFr, helpChromeFr } from "@/content/help/fr";
import { helpCatalogueVi, helpChromeVi } from "@/content/help/vi";
import type { HelpCatalogue } from "@/content/help/types";

const TRANSLATIONS: [string, HelpCatalogue][] = [
  ["fr", helpCatalogueFr],
  ["vi", helpCatalogueVi],
];
const ALL: [string, HelpCatalogue][] = [
  ["en", helpCatalogueEn],
  ...TRANSLATIONS,
];

describe("help catalogue", () => {
  it("documents at least one workflow", () => {
    expect(helpCatalogueEn.length).toBeGreaterThan(0);
  });

  it.each(ALL)("%s gives every topic a unique id", (_locale, catalogue) => {
    const ids = catalogue.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TRANSLATIONS)(
    "%s covers the same topics in the same order as en",
    (_locale, catalogue) => {
      expect(catalogue.map((topic) => topic.id)).toEqual(
        helpCatalogueEn.map((topic) => topic.id),
      );
    },
  );

  it.each(TRANSLATIONS)(
    "%s keeps the same shape as en",
    (_locale, catalogue) => {
      const shape = (c: HelpCatalogue) =>
        c.map((topic) => ({
          id: topic.id,
          steps: topic.steps.length,
          gotchas: topic.gotchas?.length ?? 0,
          workerMode: topic.workerMode ?? false,
          hasWebOnlyNote: Boolean(topic.webOnlyNote),
        }));
      expect(shape(catalogue)).toEqual(shape(helpCatalogueEn));
    },
  );

  it.each(ALL)("%s repeats no line inside a topic", (_locale, catalogue) => {
    for (const topic of catalogue) {
      expect(new Set(topic.steps).size).toBe(topic.steps.length);
      const gotchas = topic.gotchas ?? [];
      expect(new Set(gotchas).size).toBe(gotchas.length);
    }
  });

  it.each(TRANSLATIONS)(
    "%s was actually translated, not copied from en",
    (_locale, catalogue) => {
      const copied = catalogue
        .filter((topic, index) => {
          const english = helpCatalogueEn[index];
          return (
            topic.title === english.title &&
            topic.purpose === english.purpose &&
            topic.steps.join("\u0000") === english.steps.join("\u0000")
          );
        })
        .map((topic) => topic.id);
      expect(copied).toEqual([]);
    },
  );

  // The panel's own labels moved out of the locale files so the reader can pick the guide's
  // language on its own; the locale-parity suite no longer covers them.
  it.each([
    ["fr", helpChromeFr],
    ["vi", helpChromeVi],
  ])(
    "%s labels the panel with the same keys as en, none blank",
    (_locale, chrome) => {
      expect(Object.keys(chrome).sort()).toEqual(
        Object.keys(helpChromeEn).sort(),
      );
      // Jest's expect takes no message argument, so the key travels in the compared value.
      const blank = Object.entries(chrome)
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => key);
      expect(blank).toEqual([]);

      const copied = Object.entries(chrome)
        .filter(
          ([key, value]) =>
            value === helpChromeEn[key as keyof typeof helpChromeEn],
        )
        .map(([key]) => key);
      expect(copied).toEqual([]);
    },
  );

  it.each(ALL)("%s leaves no text blank", (_locale, catalogue) => {
    for (const topic of catalogue) {
      const texts = [
        topic.title,
        topic.purpose,
        topic.whoCanDoIt,
        ...topic.steps,
        ...(topic.gotchas ?? []),
        ...(topic.webOnlyNote ? [topic.webOnlyNote] : []),
      ];
      for (const text of texts) {
        expect(text.trim()).not.toBe("");
      }
    }
  });
});
