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
 */
export type AuthFlow = "otp" | "signup";

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

/** i18n key for a recognised failure, or null to show the server's message unchanged. */
export function authErrorKey(
  flow: AuthFlow,
  status: number | undefined,
): string | null {
  switch (status) {
    case 429:
      return "login.errors.throttled";
    case 503:
      return "login.errors.smsFailed";
    case 409:
      return flow === "signup" ? "login.errors.phoneTaken" : null;
    case 401:
      return "login.errors.invalidCode";
    default:
      return null;
  }
}
