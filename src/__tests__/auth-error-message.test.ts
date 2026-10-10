import i18n from "@/i18n";
import {
  authErrorKey,
  hourlyLimitMinutes,
} from "@/lib/auth/auth-error-message";

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

  it("tells the hourly code cap apart from the one-minute resend gap", () => {
    // Regression: the cap lasts up to an hour but read "Wait a minute and try again".
    for (const flow of ["otp", "signup", "phoneChange"] as const) {
      expect(authErrorKey(flow, 429, "OtpHourlyLimit")).toBe(
        "login.errors.hourlyLimit",
      );
      expect(authErrorKey(flow, 429, "TooManyRequests")).toBe(
        "login.errors.throttled",
      );
    }
  });

  it("keeps the server message for unmapped statuses", () => {
    expect(authErrorKey("otp", 400)).toBeNull();
    expect(authErrorKey("otp", 500)).toBeNull();
    expect(authErrorKey("otp", undefined)).toBeNull();
  });
});

describe("hourlyLimitMinutes", () => {
  it("rounds the Retry-After seconds up to whole minutes", () => {
    expect(hourlyLimitMinutes("OtpHourlyLimit", "2585")).toBe(44);
    expect(hourlyLimitMinutes("OtpHourlyLimit", "60")).toBe(1);
    expect(hourlyLimitMinutes("OtpHourlyLimit", "61")).toBe(2);
  });

  it("falls back to the cap's full hour without a usable Retry-After", () => {
    expect(hourlyLimitMinutes("OtpHourlyLimit", null)).toBe(60);
    expect(hourlyLimitMinutes("OtpHourlyLimit", "soon")).toBe(60);
  });

  it("is null for the short resend gap", () => {
    expect(hourlyLimitMinutes("TooManyRequests", "60")).toBeNull();
    expect(hourlyLimitMinutes(undefined, "60")).toBeNull();
  });

  it("names the wait in every language", () => {
    const t = (lng: string, count: number) =>
      i18n.t("login.errors.hourlyLimit", { lng, count });
    expect(t("en", 44)).toBe(
      "Too many codes were requested for this number. Try again in 44 minutes.",
    );
    expect(t("en", 1)).toBe(
      "Too many codes were requested for this number. Try again in 1 minute.",
    );
    expect(t("fr", 44)).toBe(
      "Trop de codes ont été demandés pour ce numéro. Réessayez dans 44 minutes.",
    );
    expect(t("vi", 44)).toBe(
      "Đã yêu cầu quá nhiều mã cho số này. Vui lòng thử lại sau 44 phút.",
    );
  });
});
