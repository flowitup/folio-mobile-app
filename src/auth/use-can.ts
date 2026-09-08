import { useAuth } from "@/auth/auth-context";
import { can } from "@/auth/permissions";

/** True when the signed-in user carries the given permission string (same names as the web app). */
export function useCan(permission: string): boolean {
  const { user } = useAuth();
  return can(user, permission);
}

/** True when the user has at least one of the permissions. */
export function useCanAny(...permissions: string[]): boolean {
  const { user } = useAuth();
  return permissions.some((permission) => can(user, permission));
}
