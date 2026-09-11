import { normalizePhone } from "@/lib/auth/phone-number";

describe("normalizePhone", () => {
  it.each([
    ["0612345678", "+33612345678"],
    ["06 12 34 56 78", "+33612345678"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["0033612345678", "+33612345678"],
    ["01 42 34 56 78", "+33142345678"],
  ])("normalises the French number %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each([
    "+84 912-345-678",
    "0084912345678",
    "+44 20 7946 0958",
    "+1 202 555 0173",
  ])("refuses %s: sign-in accepts French numbers only", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });

  // The sheet states `FR +33` beside the number, so a national form typed
  // without its trunk 0 is a French number and has to normalise.
  it.each([
    ["6 12 34 56 78", "+33612345678"],
    ["912345678", "+33912345678"],
  ])("normalises the national form %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(["", "abc", "12345", "+0123456789", "91234567", "0612345"])(
    "rejects %s",
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    },
  );
});
