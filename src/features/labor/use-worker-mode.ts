import { useAuth } from "@/auth/auth-context";
import { useWorkers } from "@/features/labor/labor-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { isWorkerMode, needsWorkerLink } from "@/lib/labor/worker-mode";

/**
 * Whether the selected project shows the restricted worker shell (own attendance, own salary,
 * own profile, task board; no Menu).
 *
 * Two inputs: the project list payload (`my_permissions`) with the JWT permissions decides
 * whether the user manages labor — a manager is never in worker mode, so the roster is not even
 * requested for them — and, for everyone else, the project's workers say whether this account is
 * linked to one (#100). The workers list is the query the worker tabs already run, so the shell
 * shares its cache and the answer flips as soon as the project switcher changes.
 *
 * No flash for a worker: until that roster answers, a non-manager stays in the worker shell (see
 * `isWorkerMode`), and `pending` says the answer is not final yet. An unlinked member is the only
 * one who moves, once, when the roster comes back without their row.
 */
export function useWorkerMode(): { workerMode: boolean; pending: boolean } {
  const { user } = useAuth();
  const { project, projectId } = useSelectedProject();
  const candidate = needsWorkerLink(project, user);
  const workers = useWorkers(projectId, candidate);
  return {
    workerMode: isWorkerMode(project, user, workers.data),
    pending: candidate && workers.isPending,
  };
}
