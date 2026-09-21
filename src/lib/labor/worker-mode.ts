import { can } from "@/auth/permissions";

/**
 * Worker mode — who gets the restricted shell.
 *
 * A signed-in user on a project is a *manager* (holder of `project:manage_labor`, through their
 * assignment's scoped permissions or a company-wide/D8-granted permission), a *worker* — an
 * account a manager linked to one of the project's worker rows — or a plain *member*. The
 * backend already narrows every labor/pay endpoint for a worker to their own linked worker; the
 * app mirrors that with a four-tab shell — their attendance, their salary, their profile (rate +
 * history) and the project's task board (tasks are gated on `project:read` server-side, so the
 * board is shared) — and no Menu.
 *
 * Lacking `manage_labor` is not enough (#100): an unlinked member has no attendance, no salary
 * and no profile to show, so the worker shell left them with the task board alone while the
 * backend lets them read most project sections. They keep the normal project shell instead —
 * four tabs plus the Menu — and only a linked worker is moved into worker mode. The former
 * project-owner bypass is gone (D6: the resolver no longer grants it) — an admin still lands
 * outside worker mode because the matrix gives `admin` `manage_labor` on every company project.
 */

type ProjectLike = { my_permissions?: string[] };
// `id` is accepted (unused by the permission check) so callers do not need to strip it.
type UserLike = { id?: string; permissions?: string[] };
/** A row of `GET /projects/{id}/workers`; only the linked account matters here. */
type WorkerLike = { user_id?: string | null };

const MANAGE_LABOR = "project:manage_labor";

/**
 * True when the worker-mode answer still depends on a linked worker row — i.e. the user holds
 * no `project:manage_labor` on this project. Callers use it to skip the workers request for a
 * manager, who is never in worker mode whatever the roster says.
 */
export function needsWorkerLink(
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

/**
 * True when the user gets the worker shell (own attendance, pay, profile, task board) on this
 * project: no `manage_labor`, *and* one of `workers` is linked to this account.
 *
 * `workers` is the project's worker rows, or `undefined` while that list is unknown (still
 * loading, or the request failed). Unknown keeps the restricted shell: only a roster that came
 * back *without* a matching row moves the user out of it. Committing to the full shell first
 * would let a worker's tabs fire the manager-scoped requests (the invoice ledger, the priced
 * day summary) their role is denied, and bounce the shell twice instead of once.
 */
export function isWorkerMode(
  project: ProjectLike | undefined,
  user: UserLike | null | undefined,
  workers: WorkerLike[] | undefined,
): boolean {
  if (!needsWorkerLink(project, user)) return false;
  if (!workers) return true;
  return workers.some(
    (worker) => Boolean(worker.user_id) && worker.user_id === user?.id,
  );
}
