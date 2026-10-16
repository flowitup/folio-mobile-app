import {
  projectDisplayName,
  projectMatchesSearch,
  projectSecondaryLabel,
} from "../lib/projects/project-display-name";
import { foldForSearch, searchIncludes } from "../lib/utils/fold-for-search";

describe("projectDisplayName", () => {
  it("shows the name first, even when the project has an address", () => {
    expect(
      projectDisplayName({
        name: "Villa Ngoc",
        address: "12 rue de la Paix, Arcueil",
      }),
    ).toBe("Villa Ngoc");
  });

  it("falls back to the address when the name is blank", () => {
    expect(projectDisplayName({ name: "  ", address: "12 rue X" })).toBe(
      "12 rue X",
    );
    expect(projectDisplayName({ name: "Villa Ngoc", address: null })).toBe(
      "Villa Ngoc",
    );
    expect(projectDisplayName({ name: "Villa Ngoc" })).toBe("Villa Ngoc");
  });
});

describe("projectSecondaryLabel", () => {
  it("is the address when it differs from the name", () => {
    expect(
      projectSecondaryLabel({ name: "Villa Ngoc", address: "12 rue X" }),
    ).toBe("12 rue X");
  });

  it("is null when the address is missing or is the name", () => {
    expect(projectSecondaryLabel({ name: "Villa Ngoc", address: " " })).toBe(
      null,
    );
    expect(
      projectSecondaryLabel({ name: "12 rue X", address: "12 rue X" }),
    ).toBe(null);
  });
});

describe("search folding", () => {
  it("ignores case, accents and đ", () => {
    expect(foldForSearch("Đường Lê Lợi")).toBe("duong le loi");
    expect(searchIncludes("Réunion chantier", "reunion")).toBe(true);
    expect(searchIncludes("anything", "  ")).toBe(true);
    expect(
      projectMatchesSearch({ name: "Villa", address: "Đường Lê Lợi" }, "le loi"),
    ).toBe(true);
  });
});
