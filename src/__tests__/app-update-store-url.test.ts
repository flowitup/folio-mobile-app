import { fallbackStoreUrl } from "@/lib/app-update/store-url";

describe("fallbackStoreUrl", () => {
  it("opens the Play listing of the app's package on Android", () => {
    expect(
      fallbackStoreUrl("android", {
        android: { package: "com.flowitup.folio" },
      }),
    ).toBe("https://play.google.com/store/apps/details?id=com.flowitup.folio");
  });

  it("prefers the store URLs of the app config", () => {
    expect(
      fallbackStoreUrl("android", {
        android: { package: "x", playStoreUrl: "https://play.example/x" },
      }),
    ).toBe("https://play.example/x");
    expect(
      fallbackStoreUrl("ios", {
        ios: { appStoreUrl: "https://apps.apple.com/app/id1" },
      }),
    ).toBe("https://apps.apple.com/app/id1");
  });

  it("always gives the blocking screen somewhere to go", () => {
    expect(fallbackStoreUrl("ios", null)).toMatch(/^itms-apps:/);
    expect(fallbackStoreUrl("android", null)).toMatch(/^market:/);
  });
});
