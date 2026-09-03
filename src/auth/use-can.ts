import { useAuth } from "@/auth/auth-context";

/** True when the signed-in user carries the given permission string (same names as the web app). */
export function useCan(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions.includes(permission) ?? false;
}

/** True when the user has at least one of the permissions. */
export function useCanAny(...permissions: string[]): boolean {
  const { user } = useAuth();
  return permissions.some((permission) =>
    user?.permissions.includes(permission),
  );
}
