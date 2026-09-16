import { ApiError } from "@/lib/query/api-error";

/**
 * Localising the two ways joining by code fails for a normal user.
 *
 * The backend answers in English ("Unknown or revoked company code"), and the join screen
 * showed that sentence straight through — inside an otherwise translated onboarding step.
 * Anything else keeps the server's own wording, which is more specific than a catch-all.
 */
export function joinErrorKey(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  switch (error.status) {
    case 404:
      return "companies.join.errors.unknownCode";
    case 409:
      return "companies.join.errors.alreadyMember";
    default:
      return null;
  }
}
