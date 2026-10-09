import { accountOptionLabel } from "@/lib/labor/account-option-label";

describe("accountOptionLabel", () => {
  it("shows the phone, not the synthetic address, of a phone-only member", () => {
    expect(
      accountOptionLabel({
        user_id: "u1",
        email: "phone-33621600101@no-email.folio.flowitup.com",
        display_name: "QA Phone Only",
        phone: "+33621600101",
      }),
    ).toBe("QA Phone Only · +33621600101");
  });

  it("falls back to the number the synthetic address was built from", () => {
    expect(
      accountOptionLabel({
        user_id: "u1",
        email: "phone-33621600101@no-email.folio.flowitup.com",
        display_name: null,
      }),
    ).toBe("+33621600101");
  });

  it("keeps a real e-mail next to the name", () => {
    expect(
      accountOptionLabel({
        user_id: "u2",
        email: "dave@example.com",
        display_name: "Dave",
        phone: "+33600000000",
      }),
    ).toBe("Dave · dave@example.com");
  });
});
