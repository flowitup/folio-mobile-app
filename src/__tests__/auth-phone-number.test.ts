import { normalizePhone } from "@/lib/auth/phone-number";

describe("normalizePhone", () => {
  it.each([
    ["0612345678", "+33612345678"],
    ["06 12 34 56 78", "+33612345678"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["0033612345678", "+33612345678"],
    ["+84 912-345-678", "+84912345678"],
    ["0084912345678", "+84912345678"],
  ])("normalises %s (France by default)", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it("uses the region argument for national numbers", () => {
    expect(normalizePhone("0912 345 678", "VN")).toBe("+84912345678");
  });

  it.each(["", "abc", "12345", "+0123456789", "912345678"])(
    "rejects %s",
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    },
  );
});
