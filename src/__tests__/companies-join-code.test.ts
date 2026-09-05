import { formatJoinCode, normalizeJoinCode } from "@/lib/companies/join-code";

describe("join code helpers", () => {
  it("normalises what people type", () => {
    expect(normalizeJoinCode(" k7q2-m9xr ")).toBe("K7Q2M9XR");
    expect(normalizeJoinCode("K7Q2 M9XR")).toBe("K7Q2M9XR");
  });

  it("formats as two groups of four", () => {
    expect(formatJoinCode("k7q2m9xr")).toBe("K7Q2-M9XR");
    expect(formatJoinCode("k7q")).toBe("K7Q");
    expect(formatJoinCode("K7Q2M9XR99")).toBe("K7Q2-M9XR");
  });
});
