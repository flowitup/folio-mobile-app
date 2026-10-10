import { laborRoleLabel } from "@/lib/labor/labor-role-label";

const t = (key: string) => `translated:${key}`;

describe("laborRoleLabel", () => {
  it("translates a seed role via its slug", () => {
    expect(laborRoleLabel({ name: "Thợ chính", slug: "tho_chinh" }, t)).toBe(
      "translated:labor.roles.tho_chinh",
    );
    expect(laborRoleLabel({ name: "Thợ phụ", slug: "tho_phu" }, t)).toBe(
      "translated:labor.roles.tho_phu",
    );
  });

  it("falls back to the stored name for a custom role (no slug)", () => {
    expect(laborRoleLabel({ name: "Électricien", slug: null }, t)).toBe(
      "Électricien",
    );
    expect(laborRoleLabel({ name: "Électricien" }, t)).toBe("Électricien");
  });

  it("translates a seed role whose name arrives decomposed", () => {
    expect(
      laborRoleLabel(
        { name: "Thợ chính".normalize("NFD"), slug: "tho_chinh" },
        t,
      ),
    ).toBe("translated:labor.roles.tho_chinh");
  });

  it("shows the company's own name for a renamed seed role", () => {
    // A rename keeps the slug: translating by slug alone made the new name never appear.
    expect(laborRoleLabel({ name: "Chef QA14", slug: "tho_chinh" }, t)).toBe(
      "Chef QA14",
    );
    expect(laborRoleLabel({ name: "Aide", slug: "tho_phu" }, t)).toBe("Aide");
  });

  it("falls back to the stored name for an unrecognised slug", () => {
    expect(
      laborRoleLabel({ name: "Custom role", slug: "not-a-seed-slug" }, t),
    ).toBe("Custom role");
  });
});
