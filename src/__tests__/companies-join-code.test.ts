import {
  extractJoinCode,
  formatJoinCode,
  normalizeJoinCode,
} from "@/lib/companies/join-code";
import { joinCodeShareMessage } from "@/lib/companies/join-code-share";

describe("join code helpers", () => {
  it("normalises what people type", () => {
    expect(normalizeJoinCode(" k7q2-m9xr ")).toBe("K7Q2M9XR");
    expect(normalizeJoinCode("K7Q2 M9XR")).toBe("K7Q2M9XR");
  });

  it("formats as two groups of four", () => {
    expect(formatJoinCode("k7q2m9xr")).toBe("K7Q2-M9XR");
    expect(formatJoinCode("k7q")).toBe("K7Q");
    expect(formatJoinCode("K7Q2M9XR99")).toBe("K7Q2-M9XR");
  });
});

describe("extractJoinCode", () => {
  it("finds the code in a pasted share message", () => {
    expect(
      extractJoinCode(
        "Rejoignez Bâti Sud sur Folio : créez votre profil dans l'app puis saisissez le code entreprise K7Q2-M9XR.",
      ),
    ).toBe("K7Q2-M9XR");
    expect(extractJoinCode("code: k7q2m9xr")).toBe("K7Q2M9XR");
  });

  it("does not take a word of the message for a code", () => {
    expect(extractJoinCode("REJOIGNEZ Bâti Sud sur Folio")).toBeNull();
  });
});

describe("joinCodeShareMessage", () => {
  const t = ((key: string, values: Record<string, string>) =>
    `${key}|${Object.values(values).join("|")}`) as never;

  it("adds where to get the app when it is configured", () => {
    expect(
      joinCodeShareMessage(
        t,
        "Bâti Sud",
        "K7Q2M9XR",
        "https://example.test/app",
      ),
    ).toBe(
      "companies.admin.manage.joinCode.shareMessageWithLink|Bâti Sud|K7Q2-M9XR|https://example.test/app",
    );
    expect(joinCodeShareMessage(t, "Bâti Sud", "K7Q2M9XR", null)).toBe(
      "companies.admin.manage.joinCode.shareMessage|Bâti Sud|K7Q2-M9XR",
    );
  });
});
