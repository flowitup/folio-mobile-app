import { authErrorKey } from "@/lib/auth/auth-error-message";

describe("authErrorKey", () => {
  it("localises the resend throttle for every flow", () => {
    for (const flow of ["password", "otp", "signup"] as const)
      expect(authErrorKey(flow, 429)).toBe("login.errors.throttled");
  });

  it("separates a wrong password from a wrong SMS code", () => {
    expect(authErrorKey("password", 401)).toBe("login.errors.badCredentials");
    expect(authErrorKey("otp", 401)).toBe("login.errors.invalidCode");
    expect(authErrorKey("signup", 401)).toBe("login.errors.invalidCode");
  });

  it("only calls a 409 a taken phone number while signing up", () => {
    expect(authErrorKey("signup", 409)).toBe("login.errors.phoneTaken");
    expect(authErrorKey("otp", 409)).toBeNull();
  });

  it("keeps the server message for unmapped statuses", () => {
    expect(authErrorKey("otp", 400)).toBeNull();
    expect(authErrorKey("otp", 500)).toBeNull();
    expect(authErrorKey("otp", undefined)).toBeNull();
  });
});
