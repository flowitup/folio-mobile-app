import {
  can,
  isCompanyAdmin,
  isCompanyAdminAnywhere,
  isPlatformOps,
} from "@/auth/permissions";
import type { AuthUser } from "@/auth/auth-context";

const company = (role: "admin" | "manager" | "member", id = "c1") => ({
  id,
  legal_name: "Folio Demo SARL",
  role,
  is_primary: false,
});

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    email: "u@example.com",
    permissions: [],
    roles: [],
    companies: [],
    ...overrides,
  } as AuthUser;
}

describe("can", () => {
  it("checks the JWT-wide permission list", () => {
    expect(can(user({ permissions: ["project:read"] }), "project:read")).toBe(
      true,
    );
    expect(can(user({ permissions: [] }), "project:read")).toBe(false);
  });

  it("honors *:* and domain wildcards", () => {
    expect(can(user({ permissions: ["*:*"] }), "project:delete")).toBe(true);
    expect(can(user({ permissions: ["project:*"] }), "project:delete")).toBe(
      true,
    );
  });

  it("treats a scoped list as authoritative, never OR'd with the JWT-wide one", () => {
    expect(can(user(), "project:read", ["project:read"])).toBe(true);
    expect(
      can(user({ permissions: ["project:read"] }), "project:read", []),
    ).toBe(false);
  });

  it("falls back to the JWT-wide list only when no scoped list is provided at all", () => {
    expect(can(user({ permissions: ["project:read"] }), "project:read")).toBe(
      true,
    );
  });

  it("does not restore a D8 deny removed from the scoped list via the JWT claim", () => {
    expect(
      can(
        user({ permissions: ["project:manage_labor"] }),
        "project:manage_labor",
        ["project:read"],
      ),
    ).toBe(false);
  });

  it("returns false for a missing user", () => {
    expect(can(null, "project:read")).toBe(false);
    expect(can(undefined, "project:read")).toBe(false);
  });
});

describe("isCompanyAdmin", () => {
  it("is true only for the admin role of the given company", () => {
    const u = user({
      companies: [company("admin", "c1"), company("member", "c2")],
    });
    expect(isCompanyAdmin(u, "c1")).toBe(true);
    expect(isCompanyAdmin(u, "c2")).toBe(false);
    expect(isCompanyAdmin(u, "c3")).toBe(false);
  });

  it("is true for a platform-ops account regardless of company role", () => {
    const u = user({
      permissions: ["*:*"],
      companies: [company("member", "c1")],
    });
    expect(isCompanyAdmin(u, "c1")).toBe(true);
  });

  it("is false without a user or company id", () => {
    expect(isCompanyAdmin(null, "c1")).toBe(false);
    expect(isCompanyAdmin(user(), undefined)).toBe(false);
  });
});

describe("isCompanyAdminAnywhere", () => {
  it("is true when admin of at least one company", () => {
    expect(
      isCompanyAdminAnywhere(
        user({ companies: [company("member", "c1"), company("admin", "c2")] }),
      ),
    ).toBe(true);
  });

  it("is false when admin of none", () => {
    expect(
      isCompanyAdminAnywhere(user({ companies: [company("member", "c1")] })),
    ).toBe(false);
  });
});

describe("isPlatformOps", () => {
  it("uses the explicit flag when present", () => {
    expect(
      isPlatformOps(user({ is_platform_ops: true, permissions: [] })),
    ).toBe(true);
    expect(
      isPlatformOps(user({ is_platform_ops: false, permissions: ["*:*"] })),
    ).toBe(false);
  });

  it("falls back to the legacy *:* wildcard while the flag is unshipped", () => {
    expect(isPlatformOps(user({ permissions: ["*:*"] }))).toBe(true);
    expect(isPlatformOps(user({ permissions: ["project:read"] }))).toBe(false);
  });

  it("is false for a missing user", () => {
    expect(isPlatformOps(null)).toBe(false);
  });
});
