import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/auth/auth-context";
import { isPlatformOps } from "@/auth/permissions";
import { useMyCompanies } from "@/features/companies/companies-api";
import { usePushNotifications } from "@/features/push/use-push-notifications";
import { useProjects } from "@/features/projects/projects-api";
import { resolveOnboardingRedirect } from "@/lib/auth/onboarding-route";

// Signed-in area: everything lives under the project-first tab shell (see (tabs)/_layout.tsx).
export default function AppLayout() {
  useOnboardingGate();
  usePushNotifications();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Onboarding hub: a user without a company creates or joins one before seeing the shell. */}
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen
        name="onboarding-create"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen name="onboarding-waiting" options={{ animation: "fade" }} />
      {/* Join a company by code — onboarding step, or "join another company" from Settings. */}
      <Stack.Screen name="join-company" options={{ animation: "fade" }} />
      {/* Team chat overlay (feature-flagged): full screen over the shell, slides in from the right. */}
      <Stack.Screen name="chat" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

/** See `resolveOnboardingRedirect` for the two gates this drives. */
function useOnboardingGate() {
  const { user } = useAuth();
  const companies = useMyCompanies();
  const projects = useProjects();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const target = resolveOnboardingRedirect({
      platformOps: isPlatformOps(user),
      companiesReady: companies.isSuccess,
      companyRoles: (companies.data ?? []).map((company) => company.role),
      projectsReady: projects.isSuccess,
      hasProjects: (projects.data?.projects.length ?? 0) > 0,
      pathname,
    });
    if (target) router.replace(target);
  }, [
    user,
    companies.isSuccess,
    companies.data,
    projects.isSuccess,
    projects.data,
    pathname,
    router,
  ]);
}
