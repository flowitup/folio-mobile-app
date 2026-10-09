import { ApiError } from "@/lib/query/api-error";

/**
 * Localising the ways joining by code fails for a normal user.
 *
 * The backend answers in English ("Unknown or revoked company code"), and the join screen
 * showed that sentence straight through — inside an otherwise translated onboarding step.
 * The rate limit (10 tries a minute) answers with the limiter's own "10 per 1 minute", which is
 * not a sentence in any language, so it gets the shared "too many attempts" text everywhere.
 * Anything else (offline, a 5xx, another 4xx) returns null: the screen falls back to
 * apiErrorMessage, which translates by status and hides framework dumps.
 */
export function joinErrorKey(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  switch (error.status) {
    case 404:
      return "companies.join.errors.unknownCode";
    case 409:
      return "companies.join.errors.alreadyMember";
    case 429:
      return "common.errors.tooManyRequests";
    default:
      return null;
  }
}
