/**
 * Localising the auth failures a user can actually hit.
 *
 * The backend answers in English (`"A code was sent recently. Wait a minute and try again."`),
 * so surfacing its message inside a translated frame produced half-Vietnamese errors. Only the
 * conditions a normal user runs into are mapped; anything else keeps the server's own wording,
 * which is more specific than a catch-all string would be.
 */

/**
 * Which sign-in path produced the error — a 409 only means something for a path that creates a
 * new phone-owning record. "signup" also covers invitation acceptance: both text a code to a
 * phone with no account yet and reject it with the same `phone_registered` conflict.
 * "phoneChange" is a signed-in user moving their account to a new number.
 */
export type AuthFlow = "otp" | "signup" | "phoneChange";

/**
 * An auth request the backend refused, carrying its HTTP status. Screens branch on the
 * status: the message is already translated, so matching words in it breaks as soon as the
 * app is not in English.
 */
export class AuthRequestError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status: number | undefined) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
  }
}

/**
 * The backend refuses a code for two reasons: the short gap between two codes ("wait a minute")
 * and the per-number hourly cap (`error: "OtpHourlyLimit"`), which can last close to an hour.
 * Whole minutes (rounded up) left on the cap, from the Retry-After header; null for the short gap.
 */
export function hourlyLimitMinutes(
  errorCode: unknown,
  retryAfter: string | null | undefined,
): number | null {
  if (errorCode !== "OtpHourlyLimit") return null;
  const seconds = Number(retryAfter);
  // The backend always sends Retry-After with the cap; without it, the cap lasts at most an hour.
  if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) return 60;
  return Math.ceil(seconds / 60);
}

/**
 * "40 s" / "3 min" for a wait in seconds (Retry-After), in the UI language; null when unknown.
 */
export function waitLabel(
  seconds: number | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds < 90
    ? t("common.errors.waitSeconds", { count: Math.ceil(seconds) })
    : t("common.errors.waitMinutes", { count: Math.ceil(seconds / 60) });
}

/** Which request of a code flow failed: asking for a code, or checking the one typed. */
export type AuthStep = "request" | "verify";

/** i18n key for a recognised failure, or null to show the server's message unchanged. */
export function authErrorKey(
  flow: AuthFlow,
  status: number | undefined,
  errorCode?: string,
  step: AuthStep = "request",
): string | null {
  switch (status) {
    case 400:
      // The phone-change endpoints are authenticated, so a wrong code is a 400 `InvalidCode`
      // there, not a 401 (which the client would read as an expired session).
      if (flow !== "phoneChange") return null;
      if (errorCode === "InvalidCode") return "login.errors.invalidCode";
      return errorCode === "PhoneUnchanged"
        ? "account.phone.errors.sameNumber"
        : "login.invalidPhone";
    case 429:
      // The hourly cap takes `count` (minutes): see `hourlyLimitMinutes`.
      if (errorCode === "OtpHourlyLimit") return "login.errors.hourlyLimit";
      // The others take `wait` ("40 s"): see `waitLabel`. A crew signing in on one site Wi-Fi
      // hits the network's cap, not their own number's: never tell them a code was sent.
      if (errorCode === "NetworkThrottled")
        return "login.errors.networkThrottled";
      // The platform's SMS budget ran out: nothing the user's number did.
      if (errorCode === "SmsServiceBusy") return "login.errors.smsBusy";
      // Checking a code sends nothing: "a code was sent a moment ago" would be wrong there.
      if (step === "verify") return "login.errors.tooManyTries";
      return "login.errors.throttled";
    case 503:
      return "login.errors.smsFailed";
    case 409:
      if (flow === "phoneChange") return "account.phone.errors.phoneTaken";
      return flow === "signup" ? "login.errors.phoneTaken" : null;
    case 401:
      return "login.errors.invalidCode";
    default:
      return null;
  }
}
