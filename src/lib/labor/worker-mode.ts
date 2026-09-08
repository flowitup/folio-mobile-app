import { can } from "@/auth/permissions";

/**
 * Worker mode — who gets the restricted shell.
 *
 * A signed-in user on a project is either a *manager* (holder of `project:manage_labor`,
 * through their assignment's scoped permissions or a company-wide/D8-granted permission) or a
 * *worker*. The backend already narrows every labor/pay endpoint for workers to their own
 * linked worker; the app mirrors that by showing only two tabs: their attendance and their
 * salary. The former project-owner bypass is gone (D6: the resolver no longer grants it) — an
 * admin still lands here as a manager because the matrix gives `admin` `manage_labor` on every
 * company project.
 */

type ProjectLike = { my_permissions?: string[] };
// `id` is accepted (unused) so callers do not need to strip it from the auth user object.
type UserLike = { id?: string; permissions?: string[] };

const MANAGE_LABOR = "project:manage_labor";

/** True when the user must see only their own attendance and pay on this project. */
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
