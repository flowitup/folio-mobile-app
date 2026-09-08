/** Onboarding screens reached before a company exists (hub, create, join-by-code). */
export const ONBOARDING_PATHS = [
  "/onboarding",
  "/onboarding-create",
  "/join-company",
] as const;
/**
 * Onboarding-only screens: once the caller has at least one company role, landing here bounces
 * back to "/". `/join-company` is deliberately excluded — it is dual-purpose (the onboarding
 * join step for a company-less user, and "join another company" opened from Settings by an
 * existing member/admin with `?another=1`), so it must stay reachable once a company exists.
 */
const REDIRECT_ON_ARRIVAL_PATHS = [
  "/onboarding",
  "/onboarding-create",
] as const;
/** Reached once a company exists but the caller has no project assignment anywhere. */
export const WAITING_PATH = "/onboarding-waiting";

/** Strips a `?query` suffix so callers can pass either a bare pathname or one with a search string. */
function stripQuery(pathname: string): string {
  const index = pathname.indexOf("?");
  return index === -1 ? pathname : pathname.slice(0, index);
}

export type OnboardingRedirectInput = {
  /** Platform-ops accounts (D5) skip both gates entirely. */
  platformOps: boolean;
  /** `useMyCompanies()` has resolved (avoid redirecting on the loading flash). */
  companiesReady: boolean;
  /** The caller's role in each attached company. */
  companyRoles: string[];
  /** `useProjects()` has resolved. */
  projectsReady: boolean;
  /** True once the caller can see at least one project. */
  hasProjects: boolean;
  pathname: string;
};

/**
 * Where to send a signed-in user given their onboarding state, or `null` to leave them where
 * they are. Two gates: no company at all → the onboarding hub; a member (never admin/manager)
 * of every attached company with no project assignment → the waiting screen. Also bounces back
 * out of any onboarding screen once its condition stops holding (e.g. a foreground refresh
 * picks up a fresh assignment while the waiting screen is showing).
 */
export function resolveOnboardingRedirect(
  input: OnboardingRedirectInput,
): string | null {
  const {
    platformOps,
    companiesReady,
    companyRoles,
    projectsReady,
    hasProjects,
    pathname: rawPathname,
  } = input;
  if (platformOps || !companiesReady) return null;

  const pathname = stripQuery(rawPathname);

  if (companyRoles.length === 0) {
    return (ONBOARDING_PATHS as readonly string[]).includes(pathname)
      ? null
      : "/onboarding";
  }

  const memberEverywhere = companyRoles.every((role) => role === "member");
  const noAssignment = projectsReady && !hasProjects;
  if (memberEverywhere && noAssignment) {
    return pathname === WAITING_PATH ? null : WAITING_PATH;
  }

  if (
    (REDIRECT_ON_ARRIVAL_PATHS as readonly string[]).includes(pathname) ||
    pathname === WAITING_PATH
  )
    return "/";
  return null;
}
