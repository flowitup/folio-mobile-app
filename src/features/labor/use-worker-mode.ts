import { useAuth } from "@/auth/auth-context";
import { useSelectedProject } from "@/features/projects/selected-project";
import { isWorkerMode } from "@/lib/labor/worker-mode";

/**
 * Whether the selected project shows the restricted worker shell (own attendance, own
 * salary, own profile, task board; no Menu). Decided from the project list payload (`my_permissions`) and the JWT
 * permissions, so it needs no extra request and flips as soon as the project switcher changes.
 */
export function useWorkerMode(): { workerMode: boolean } {
  const { user } = useAuth();
  const { project } = useSelectedProject();
  return { workerMode: isWorkerMode(project, user) };
}
