import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/auth/auth-context";
import { useMyCompanies } from "@/features/companies/companies-api";

// Signed-in area: everything lives under the project-first tab shell (see (tabs)/_layout.tsx).
export default function AppLayout() {
  useCompanyGate();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Onboarding: a user without a company types a join code before seeing the shell. */}
      <Stack.Screen name="join-company" options={{ animation: "fade" }} />
      {/* Team chat overlay (feature-flagged): full screen over the shell, slides in from the right. */}
      <Stack.Screen name="chat" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

/** Sends a signed-in user who belongs to no company to the join screen (superadmins are exempt). */
function useCompanyGate() {
  const { user } = useAuth();
  const companies = useMyCompanies();
  const pathname = usePathname();
  const router = useRouter();
  const superadmin = user?.permissions.includes("*:*") ?? false;
  const needsCompany =
    !superadmin && companies.isSuccess && companies.data.length === 0;

  useEffect(() => {
    if (needsCompany && pathname !== "/join-company")
      router.replace("/join-company");
  }, [needsCompany, pathname, router]);
}
