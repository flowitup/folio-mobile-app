import { authErrorKey } from "@/lib/auth/auth-error-message";

describe("authErrorKey", () => {
  it("localises the resend throttle for every flow", () => {
    for (const flow of ["otp", "signup"] as const)
      expect(authErrorKey(flow, 429)).toBe("login.errors.throttled");
  });

  it("maps a wrong or expired code the same way for every flow", () => {
    expect(authErrorKey("otp", 401)).toBe("login.errors.invalidCode");
    expect(authErrorKey("signup", 401)).toBe("login.errors.invalidCode");
  });

  it("only calls a 409 a taken phone number while signing up", () => {
    expect(authErrorKey("signup", 409)).toBe("login.errors.phoneTaken");
    expect(authErrorKey("otp", 409)).toBeNull();
  });

  it("maps the phone-change refusals, which answer 400 rather than 401", () => {
    expect(authErrorKey("phoneChange", 400, "InvalidCode")).toBe(
      "login.errors.invalidCode",
    );
    expect(authErrorKey("phoneChange", 400, "PhoneUnchanged")).toBe(
      "account.phone.errors.sameNumber",
    );
    expect(authErrorKey("phoneChange", 400, "ValidationError")).toBe(
      "login.invalidPhone",
    );
    expect(authErrorKey("phoneChange", 409)).toBe(
      "account.phone.errors.phoneTaken",
    );
    expect(authErrorKey("phoneChange", 429)).toBe("login.errors.throttled");
    expect(authErrorKey("phoneChange", 503)).toBe("login.errors.smsFailed");
  });

  it("keeps the server message for unmapped statuses", () => {
    expect(authErrorKey("otp", 400)).toBeNull();
    expect(authErrorKey("otp", 500)).toBeNull();
    expect(authErrorKey("otp", undefined)).toBeNull();
  });
});
