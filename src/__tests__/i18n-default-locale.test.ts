import * as SecureStore from "expo-secure-store";

import i18n, { DEFAULT_LOCALE, SUPPORTED_LOCALES, setLocale } from "../i18n";

// The module reads a stored locale at import time; an empty store leaves the default in place.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(
      async (key: string, value: string) => void store.set(key, value),
    ),
  };
});

describe("i18n default locale", () => {
  it("starts in Vietnamese when nothing is stored", () => {
    expect(DEFAULT_LOCALE).toBe("vi");
    expect(i18n.language).toBe("vi");
    expect(i18n.t("settings.language")).toBe("Ngôn ngữ");
  });

  it("falls back to Vietnamese instead of English", () => {
    expect(i18n.options.fallbackLng).toEqual(["vi"]);
  });

  it("still offers the three web-app locales", () => {
    expect([...SUPPORTED_LOCALES]).toEqual(["en", "fr", "vi"]);
  });

  it("lets a Settings choice override the default and remembers it", async () => {
    await setLocale("fr");
    expect(i18n.language).toBe("fr");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("folio.locale", "fr");

    await setLocale(DEFAULT_LOCALE);
    expect(i18n.language).toBe("vi");
  });
});
