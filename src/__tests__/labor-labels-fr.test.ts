import fr from "../i18n/locales/fr.json";

/**
 * The overtime shift is paid 1.5× a day while the extra hours are not paid: the two are shown
 * side by side on the attendance forms and must not read the same in French.
 */
describe("French labor labels", () => {
  it("keeps the paid overtime shift apart from the unpaid extra hours", () => {
    const overtime = fr.labor.shift.overtime;
    expect(overtime).not.toBe(fr.labor.log.supplement);
    expect(overtime).not.toBe(fr.worker.supplement);
    expect(fr.labor.log.supplement.startsWith("Heures sup")).toBe(false);
    expect(fr.worker.supplement.startsWith("Heures sup")).toBe(false);
  });
});
