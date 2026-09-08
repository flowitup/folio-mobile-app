import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { useMyCompanies } from "@/features/companies/companies-api";
import { useProjects } from "@/features/projects/projects-api";
import { useTokens } from "@/theme/tokens";

/**
 * Onboarding · waiting: a member of at least one company but assigned to no project yet (D1
 * onboarding leaves this gap between "admin added me" and "admin assigned me"). Pull to refresh
 * — the app also re-checks on every foreground: `AuthProvider`'s `AppState` listener refreshes
 * the access token, re-fetches `/auth/me`, and flips TanStack Query's `focusManager`, which
 * refetches `useMyCompanies`/`useProjects` here automatically (no manual call needed).
 */
export default function OnboardingWaitingScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { signOut } = useAuth();
  const companies = useMyCompanies();
  const projects = useProjects();
  const company =
    companies.data?.find((c) => c.is_primary) ?? companies.data?.[0];
  const refreshing = companies.isFetching || projects.isFetching;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-7 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void companies.refetch();
              void projects.refetch();
            }}
            tintColor={tokens.ink}
          />
        }
      >
        <View className="mb-7 h-11 w-11 items-center justify-center rounded-xl bg-ink">
          <Text className="font-serif text-2xl text-on-ink">F</Text>
        </View>
        <Text className="mb-1.5 font-serif text-[28px] tracking-[-0.28px] text-ink">
          {t("onboarding.waiting.title")}
        </Text>
        <Text
          testID="onboarding-waiting-company"
          className="mb-2 font-sans-medium text-[15px] text-ink"
        >
          {company?.legal_name ?? "…"}
        </Text>
        <Text className="mb-8 font-sans text-[14px] text-muted">
          {t("onboarding.waiting.subtitle")}
        </Text>

        <Pressable
          testID="onboarding-waiting-sign-out"
          accessibilityRole="button"
          onPress={() => void signOut()}
          hitSlop={8}
          className="self-start"
        >
          <Text className="font-sans text-[13px] text-negative">
            {t("home.signOut")}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
