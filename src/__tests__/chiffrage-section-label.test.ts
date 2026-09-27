import en from "../i18n/locales/en.json";
import fr from "../i18n/locales/fr.json";
import vi from "../i18n/locales/vi.json";

/** The chiffrage section is named in each UI language, as on the web app. */
describe("chiffrage section label", () => {
  it("is translated in English and Vietnamese and stays 'Chiffrage' in French", () => {
    expect(en.project.sections.chiffrage).toBe("Cost planning");
    expect(vi.project.sections.chiffrage).toBe("Hoạch toán");
    expect(fr.project.sections.chiffrage).toBe("Chiffrage");
  });
});
