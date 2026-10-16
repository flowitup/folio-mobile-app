import en from "../i18n/locales/en.json";
import fr from "../i18n/locales/fr.json";
import vi from "../i18n/locales/vi.json";

/** The chiffrage section is named in each UI language, as on the web app. */
describe("chiffrage section label", () => {
  it("is translated in English and Vietnamese and stays 'Chiffrage' in French", () => {
    expect(en.project.sections.chiffrage).toBe("Cost planning");
    expect(vi.project.sections.chiffrage).toBe("Hạch toán");
    expect(fr.project.sections.chiffrage).toBe("Chiffrage");
  });
});

/** Section names match the web navigation; "Factures" means customer invoices only. */
describe("project section glossary", () => {
  it("calls the expense screens Dépenses / Expenses / Chi phí, like the expenses tab", () => {
    expect(fr.project.sections.invoices).toBe(fr.tabs.expenses);
    expect(en.project.sections.invoices).toBe(en.tabs.expenses);
    expect(vi.project.sections.invoices).toBe(vi.tabs.expenses);
    expect(fr.project.sections.settings).toBe(fr.tabs.settings);
  });

  it("writes Vietnamese tone marks in one style (Xóa, ủy), as the web does", () => {
    const text = JSON.stringify(vi);
    expect(text).not.toMatch(/Xoá|xoá|uỷ/);
  });
});
