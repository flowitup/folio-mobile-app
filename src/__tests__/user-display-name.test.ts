import {
  accountContact,
  phoneOfSyntheticEmail,
  realEmail,
  userDisplayName,
} from "@/lib/auth/user-display-name";

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

describe("synthetic phone sign-up address", () => {
  const synthetic = "phone-33600000097@no-email.folio.flowitup.com";

  it("is not a real e-mail", () => {
    expect(realEmail(synthetic)).toBeNull();
    expect(realEmail(" jean@example.com ")).toBe("jean@example.com");
    expect(realEmail(null)).toBeNull();
  });

  it("gives back the phone number it was built from", () => {
    expect(phoneOfSyntheticEmail(synthetic)).toBe("+33600000097");
    expect(phoneOfSyntheticEmail("jean@example.com")).toBeNull();
  });
});

describe("accountContact", () => {
  it("shows the current phone, not the number the synthetic address was built from", () => {
    // After a phone change the address still holds the sign-up number.
    expect(
      accountContact("phone-33620150003@no-email.folio.flowitup.com", "+33620150004"),
    ).toBe("+33620150004");
  });

  it("prefers a real e-mail", () => {
    expect(accountContact("jean@example.com", "+33620150004")).toBe("jean@example.com");
  });

  it("falls back to the synthetic address's phone when the payload has none", () => {
    expect(accountContact("phone-33620150003@no-email.folio.flowitup.com", null)).toBe(
      "+33620150003",
    );
    expect(accountContact("phone-33620150003@no-email.folio.flowitup.com", "  ")).toBe(
      "+33620150003",
    );
  });
});
