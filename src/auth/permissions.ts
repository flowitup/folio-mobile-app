import type { AuthUser } from "@/auth/auth-context";

/** True when `list` grants `permission`, honoring the `*:*` and `<domain>:*` wildcards. */
function grants(list: string[] | undefined, permission: string): boolean {
  if (!list) return false;
  return (
    list.includes(permission) ||
    list.includes("*:*") ||
    list.includes(`${permission.split(":")[0]}:*`)
  );
}

/**
 * True when the signed-in user carries `permission`. A scoped list (`project.my_permissions`,
 * a D8-resolved list, …) is authoritative when provided — it is already
 * `(JWT ∪ membership ∪ resolver) − denies`, so the JWT-wide list (`user.permissions`) is never
 * OR'd back in; doing so would resurrect a permission a D8 deny explicitly removed. The
 * JWT-wide list is used only as a fallback when no scoped list is provided at all (e.g. the
 * project has not loaded yet). Same permission strings and wildcard rules as the web app.
 */
export function can(
  user: Pick<AuthUser, "permissions"> | null | undefined,
  permission: string,
  scoped?: string[],
): boolean {
  if (scoped !== undefined) return grants(scoped, permission);
  return grants(user?.permissions, permission);
}

/** True when the user is `admin` of the given company (or a platform-ops account). */
export function isCompanyAdmin(
  user: AuthUser | null | undefined,
  companyId: string | undefined | null,
): boolean {
  if (!user || !companyId) return false;
  if (isPlatformOps(user)) return true;
  return (
    user.companies?.some(
      (company) => company.id === companyId && company.role === "admin",
    ) ?? false
  );
}

/** True when the user is `admin` of at least one attached company (or platform-ops). */
export function isCompanyAdminAnywhere(
  user: AuthUser | null | undefined,
): boolean {
  if (!user) return false;
  if (isPlatformOps(user)) return true;
  return user.companies?.some((company) => company.role === "admin") ?? false;
}

/**
 * Hidden flowitup-support flag (D5) — not a role. The backend has not shipped
 * `is_platform_ops` on `/auth/me` yet (Phase 3 of the roles/permissions redesign), so this
 * falls back to the legacy `*:*` wildcard until it does; once the field is present it is
 * authoritative.
 */
export function isPlatformOps(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (typeof user.is_platform_ops === "boolean") return user.is_platform_ops;
  return user.permissions.includes("*:*");
}
