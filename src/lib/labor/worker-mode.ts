import { can } from "@/auth/permissions";

/**
 * Worker mode — who gets the restricted shell.
 *
 * A signed-in user on a project is either a *manager* (holder of `project:manage_labor`,
 * through their assignment's scoped permissions or a company-wide/D8-granted permission) or a
 * *worker*. The backend already narrows every labor/pay endpoint for workers to their own
 * linked worker; the app mirrors that with a four-tab shell — their attendance, their salary,
 * their profile (rate + history) and the project's task board (tasks are gated on `project:read`
 * server-side, so the board is shared) — and no Menu. The former project-owner bypass is gone (D6: the resolver no longer grants it) — an
 * admin still lands here as a manager because the matrix gives `admin` `manage_labor` on every
 * company project.
 */

type ProjectLike = { my_permissions?: string[] };
// `id` is accepted (unused) so callers do not need to strip it from the auth user object.
type UserLike = { id?: string; permissions?: string[] };

const MANAGE_LABOR = "project:manage_labor";

/** True when the user gets the worker shell (own attendance, pay, profile, task board) on this project. */
export function isWorkerMode(
  project: ProjectLike | undefined,
  user: UserLike | null | undefined,
): boolean {
  if (!project || !user) return false;
  return !can(
    { permissions: user.permissions ?? [] },
    MANAGE_LABOR,
    project.my_permissions,
  );
}
