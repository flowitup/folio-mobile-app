import en from "../i18n/locales/en.json";
import fr from "../i18n/locales/fr.json";
import vi from "../i18n/locales/vi.json";

// Flattens nested translation objects into dotted key paths for comparison.
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n locales", () => {
  const enKeys = flattenKeys(en).sort();

  it.each([
    ["fr", fr],
    ["vi", vi],
  ])("%s has exactly the same keys as en", (_name, locale) => {
    expect(flattenKeys(locale).sort()).toEqual(enKeys);
  });
});
