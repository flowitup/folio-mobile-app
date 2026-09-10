import { userDisplayName } from "@/lib/auth/user-display-name";

describe("userDisplayName", () => {
  it("prefers the name chosen at sign-up", () => {
    expect(
      userDisplayName({
        display_name: "Nguyen Van A",
        email: "phone-33600910011@no-email.folio.flowitup.com",
      }),
    ).toBe("Nguyen Van A");
  });

  it("falls back to the e-mail when no display name is set", () => {
    expect(
      userDisplayName({ display_name: null, email: "chef@folio.fr" }),
    ).toBe("chef@folio.fr");
  });

  it("treats a blank display name as unset", () => {
    expect(userDisplayName({ display_name: "   ", email: "a@b.fr" })).toBe(
      "a@b.fr",
    );
  });

  it("returns an empty string for a missing user", () => {
    expect(userDisplayName(null)).toBe("");
    expect(userDisplayName(undefined)).toBe("");
    expect(userDisplayName({})).toBe("");
  });
});
