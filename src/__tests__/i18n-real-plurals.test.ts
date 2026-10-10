import i18n from "../i18n";
import en from "../i18n/locales/en.json";
import fr from "../i18n/locales/fr.json";
import vi from "../i18n/locales/vi.json";
import { formatNumber } from "@/lib/format/money";
import { dayCount } from "@/lib/labor/day-count";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

function strings(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  return Object.entries(value as object).flatMap(([key, child]) =>
    strings(child, prefix ? `${prefix}.${key}` : key),
  );
}

/** A day count as the labor screens render it: locale decimals, agreeing unit. */
function perDay(lng: string, days: number): string {
  return i18n.getFixedT(lng)("labor.workers.perDay", {
    count: dayCount(days),
    value: formatNumber(days, 2) || "0",
  });
}

describe("real plurals instead of '(s)'", () => {
  afterAll(() => i18n.changeLanguage("vi"));

  it.each([
    ["en", en],
    ["fr", fr],
    ["vi", vi],
  ])("%s has no '(s)' pseudo-plural driven by {{count}}", (_lng, locale) => {
    const offenders = strings(locale).filter(
      ([, text]) => text.includes("{{count}}") && /\(e?s\)/.test(text),
    );
    expect(offenders).toEqual([]);
  });

  it("agrees the worker count on the log button", () => {
    const en = i18n.getFixedT("en");
    const fr = i18n.getFixedT("fr");
    expect(en("labor.log.submit", { count: 1 })).toBe("Log 1 worker");
    expect(en("labor.log.submit", { count: 3 })).toBe("Log 3 workers");
    expect(fr("labor.log.submit", { count: 1 })).toBe("Saisir 1 ouvrier");
    expect(fr("salaries.unpaidConfirm", { count: 2, month: "mai" })).toBe(
      "Supprimer les 2 paiements enregistrés pour mai ? Le mois repassera en non payé.",
    );
  });

  it("says '1 day' and uses the locale's decimal separator", async () => {
    await i18n.changeLanguage("en");
    expect(perDay("en", 1)).toBe("per day · 1 day");
    expect(perDay("en", 2.5)).toBe("per day · 2.5 days");
    await i18n.changeLanguage("fr");
    expect(perDay("fr", 0.5)).toBe("par jour · 0,5 jour");
    expect(perDay("fr", 3)).toBe("par jour · 3 jours");
    expect(
      i18n.getFixedT("fr")("labor.overview.daysUnit", { count: dayCount(1) }),
    ).toBe("jour");
    await i18n.changeLanguage("vi");
    expect(perDay("vi", 0.5)).toBe("mỗi ngày · 0,5 ngày");
  });

  it("rounds the count to what is shown", () => {
    expect(dayCount(0.999)).toBe(1);
    expect(dayCount(1.04, 1)).toBe(1);
    expect(dayCount(2.5)).toBe(2.5);
  });
});
