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

/** i18n key for a recognised failure, or null to show the server's message unchanged. */
export function authErrorKey(
  flow: AuthFlow,
  status: number | undefined,
  errorCode?: string,
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
      return errorCode === "OtpHourlyLimit"
        ? "login.errors.hourlyLimit"
        : "login.errors.throttled";
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
