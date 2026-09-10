/**
 * How the signed-in user is labelled in the shell (avatar initial, account sheet).
 *
 * Phone sign-ups have no real e-mail: the backend mints a synthetic
 * `phone-<number>@no-email.folio.flowitup.com` address, so every such account rendered the
 * same "P" initial and showed that address as its name. The name the user typed at sign-up
 * (`display_name`) is what teammates are promised they will see, so it wins when present.
 * Mirrors the backend's `User.display_or_email`.
 */

type UserLike = { display_name?: string | null; email?: string | null };

/** Display label for `user`, or an empty string when there is nothing to show. */
export function userDisplayName(user: UserLike | null | undefined): string {
  return user?.display_name?.trim() || user?.email?.trim() || "";
}
