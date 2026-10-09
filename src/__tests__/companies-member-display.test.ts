import {
  memberDisplayName,
  memberSecondaryLabel,
  shortUserId,
} from "@/lib/companies/member-display";

describe("member display helpers", () => {
  it("prefers display name, then email, then phone, never a raw UUID", () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    expect(
      memberDisplayName({
        display_name: "Jean Dupont",
        email: "jean@example.com",
        phone: "+33600000000",
        user_id: userId,
      }),
    ).toBe("Jean Dupont");
    expect(
      memberDisplayName({
        display_name: null,
        email: "jean@example.com",
        phone: "+33600000000",
        user_id: userId,
      }),
    ).toBe("jean@example.com");
    expect(
      memberDisplayName({
        display_name: null,
        email: null,
        phone: "+33600000000",
        user_id: userId,
      }),
    ).toBe("+33600000000");
    expect(
      memberDisplayName({
        display_name: null,
        email: null,
        phone: null,
        user_id: userId,
      }),
    ).toBe(shortUserId(userId));
  });

  it("shortens a raw user id to a short readable fallback", () => {
    expect(shortUserId("11111111-2222-3333-4444-555555555555")).toBe(
      "#11111111",
    );
  });

  it("secondary label skips the primary display name and falls back the same way", () => {
    const userId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(
      memberSecondaryLabel({
        display_name: "Jean Dupont",
        email: "jean@example.com",
        phone: null,
        user_id: userId,
      }),
    ).toBe("jean@example.com");
    expect(
      memberSecondaryLabel({
        display_name: null,
        email: null,
        phone: null,
        user_id: userId,
      }),
    ).toBe(shortUserId(userId));
  });

  it("shows a phone sign-up's number, never its synthetic no-email address", () => {
    // The backend mints `phone-<digits>@no-email.folio.flowitup.com` for a phone sign-up;
    // the company Members list and the manage Users tab printed it as the member's contact.
    const userId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const synthetic = "phone-33621400002@no-email.folio.flowitup.com";
    expect(
      memberSecondaryLabel({
        display_name: "QA Joiner",
        email: synthetic,
        phone: "+33621400002",
        user_id: userId,
      }),
    ).toBe("+33621400002");
    expect(
      memberDisplayName({
        display_name: null,
        email: synthetic,
        phone: "+33621400002",
        user_id: userId,
      }),
    ).toBe("+33621400002");
    // Older payloads without `phone`: the number the address was built from.
    expect(
      memberSecondaryLabel({ email: synthetic, phone: null, user_id: userId }),
    ).toBe("+33621400002");
    expect(memberDisplayName({ email: synthetic, user_id: userId })).toBe(
      "+33621400002",
    );
  });
});
