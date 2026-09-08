import { useAuth } from "@/auth/auth-context";
import { projectCan, useProjects } from "@/features/projects/projects-api";

/**
 * Project-scoped permission check for a project reached by id (route param or the shell's
 * selection). Every row of the projects list carries its own `my_permissions`, so the scoped
 * answer comes from the list query the shell already runs — no extra request. The JWT-wide list
 * only answers while that query is still loading, which is what `projectCan` falls back to.
 */
export function useProjectCan(
  projectId: string | undefined,
  permission: string,
): boolean {
  const { user } = useAuth();
  const projects = useProjects();
  const project = projects.data?.projects.find(
    (candidate) => candidate.id === projectId,
  );
  return projectCan(project, permission, user?.permissions);
}
