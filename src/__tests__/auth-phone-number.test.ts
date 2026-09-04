import { normalizePhone } from "@/lib/auth/phone-number";

describe("normalizePhone", () => {
  it.each([
    ["0912345678", "+84912345678"],
    ["0912 345 678", "+84912345678"],
    ["+84 912-345-678", "+84912345678"],
    ["0084912345678", "+84912345678"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("normalises %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it("uses the default region for national numbers", () => {
    expect(normalizePhone("06 12 34 56 78", "FR")).toBe("+33612345678");
  });

  it.each(["", "abc", "12345", "+0123456789", "912345678"])(
    "rejects %s",
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    },
  );
});
