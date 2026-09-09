import { projectDisplayName } from "../lib/projects/project-display-name";

describe("projectDisplayName", () => {
  it("shows the address when the project has one", () => {
    expect(
      projectDisplayName({
        name: "Villa Ngoc",
        address: "12 rue de la Paix, Arcueil",
      }),
    ).toBe("12 rue de la Paix, Arcueil");
  });

  it("falls back to the name when the address is missing or blank", () => {
    expect(projectDisplayName({ name: "Villa Ngoc", address: null })).toBe(
      "Villa Ngoc",
    );
    expect(projectDisplayName({ name: "Villa Ngoc", address: "   " })).toBe(
      "Villa Ngoc",
    );
    expect(projectDisplayName({ name: "Villa Ngoc" })).toBe("Villa Ngoc");
  });
});
