import i18n from "@/i18n";
import { formatFileSize } from "@/lib/format/file-size";
import { formatNumber } from "@/lib/format/money";

/** French slips: '0.5 jour(s)', 'KB' and '0 KB', '1 ouvriers actifs'. */
describe("French units and plurals", () => {
  afterEach(async () => {
    await i18n.changeLanguage("vi");
  });

  it("writes file sizes with the French units and never 0", async () => {
    await i18n.changeLanguage("fr");
    expect(formatFileSize(200)).toBe("1 Ko");
    expect(formatFileSize(312 * 1024)).toBe("312 Ko");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 Mo");
    await i18n.changeLanguage("en");
    expect(formatFileSize(312 * 1024)).toBe("312 KB");
  });

  it("counts half days with a decimal comma and the right plural", async () => {
    await i18n.changeLanguage("fr");
    const days = (count: number) =>
      i18n.t("salaries.days", { count, value: formatNumber(count, 1) });
    expect(days(0.5)).toBe("0,5 jour");
    expect(days(1)).toBe("1 jour");
    expect(days(9.5)).toBe("9,5 jours");
    await i18n.changeLanguage("en");
    expect(i18n.t("salaries.days", { count: 1, value: "1" })).toBe("1 day");
  });

  it("agrees the active-workers line with its count", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("labor.headerSub", { count: 1, month: "sept." })).toBe(
      "1 ouvrier actif · sept.",
    );
    expect(i18n.t("labor.headerSub", { count: 3, month: "sept." })).toBe(
      "3 ouvriers actifs · sept.",
    );
  });
});
