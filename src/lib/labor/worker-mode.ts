/**
 * Worker mode — who gets the restricted shell.
 *
 * A signed-in user on a project is either a *manager* (project owner, superadmin, or holder
 * of `project:manage_labor` globally or through their membership role) or a *worker*. The
 * backend narrows every labor/pay endpoint for workers to their own linked worker; the app
 * mirrors that by showing only two tabs: their attendance and their salary.
 */

type ProjectLike = { owner_id?: string; my_permissions?: string[] };
type UserLike = { id?: string; permissions?: string[] };

const MANAGE_LABOR = "project:manage_labor";

function grants(list: string[] | undefined, permission: string): boolean {
  if (!list) return false;
  return (
    list.includes(permission) ||
    list.includes("*:*") ||
    list.includes(`${permission.split(":")[0]}:*`)
  );
}

/** True when the user must see only their own attendance and pay on this project. */
export function isWorkerMode(
  project: ProjectLike | undefined,
  user: UserLike | null | undefined,
): boolean {
  if (!project || !user) return false;
  if (project.owner_id && project.owner_id === user.id) return false;
  return (
    !grants(project.my_permissions, MANAGE_LABOR) &&
    !grants(user.permissions, MANAGE_LABOR)
  );
}
