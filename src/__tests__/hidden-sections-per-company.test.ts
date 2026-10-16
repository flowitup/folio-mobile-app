/**
 * The Menu hides a project section when the selected project's company hides it (not the
 * primary company), and a company-wide area only when every company of the user hides it.
 */

import { hiddenSectionsFor } from "@/features/companies/hidden-sections";
import { pickSettingsCompany } from "@/features/companies/settings-company";

jest.mock("@/api/client", () => ({ api: {} }));
jest.mock("@/auth/auth-context", () => ({ useAuth: () => ({ user: null }) }));

const A = { id: "a", is_primary: true, hidden_sections: ["notes", "library"] };
const B = { id: "b", is_primary: false, hidden_sections: ["photos", "library", "billing"] };

describe("hiddenSectionsFor", () => {
  it("follows the selected project's company for project sections", () => {
    expect([...hiddenSectionsFor([A, B], "b")].sort()).toEqual(["library", "photos"]);
    expect([...hiddenSectionsFor([A, B], "a")].sort()).toEqual(["library", "notes"]);
  });

  it("hides an area only when every company hides it", () => {
    expect(hiddenSectionsFor([A, B], "b").has("billing")).toBe(false);
    expect(hiddenSectionsFor([B], "b").has("billing")).toBe(true);
    const C = { id: "c", is_primary: false };
    expect(hiddenSectionsFor([A, C], "a").has("library")).toBe(
      false,
    );
  });

  it("hides no project section while the project's company is unknown", () => {
    expect([...hiddenSectionsFor([A, B], undefined)]).toEqual(["library"]);
    expect([...hiddenSectionsFor([A], undefined)].sort()).toEqual(["library", "notes"]);
  });
});

describe("pickSettingsCompany", () => {
  it("prefers the picked company, then the project's, then the primary, then the first", () => {
    expect(pickSettingsCompany([A, B], "b", "a")?.id).toBe("b");
    expect(pickSettingsCompany([A, B], null, "b")?.id).toBe("b");
    expect(pickSettingsCompany([A, B], null, "zz")?.id).toBe("a");
    expect(pickSettingsCompany([B], null, "a")?.id).toBe("b");
    expect(pickSettingsCompany([], null, null)).toBeUndefined();
  });
});
