import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useThemePreference } from "@/theme/theme-preference";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { isPlatformOps } from "@/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, ListRow } from "@/components/ui/primitives";
import { LanguageChips } from "@/components/language-chips";
import { LegalLinks } from "@/components/legal-links";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useMyCompanies } from "@/features/companies/companies-api";
import { useCanManageHiddenSections } from "@/features/companies/hidden-sections";
import { usePaymentMethods } from "@/features/invoices/invoices-api";
import { useLaborRoles } from "@/features/labor/labor-api";
import { pickSettingsCompany } from "@/features/companies/settings-company";
import { useOptionalSelectedProject } from "@/features/projects/selected-project";
import { refreshKeys, usePullToRefresh } from "@/lib/query/use-pull-to-refresh";

/** Cài đặt hub: list card with a value column (company name, counts) and chevrons; About card; outline sign-out. */
export default function SettingsHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const superadmin = isPlatformOps(user);
  const companies = useMyCompanies();
  const primary = companies.data?.[0];
  // Same list as the screen this row opens (inactive methods included), so the count matches its rows.
  const paymentMethods = usePaymentMethods(primary?.id, {
    includeInactive: true,
  });
  // The company the labor-roles screen opens on (the selected project's, then the primary).
  const rolesCompany = pickSettingsCompany(
    companies.data ?? [],
    null,
    useOptionalSelectedProject()?.project?.company_id,
  );
  const roles = useLaborRoles(rolesCompany?.id);
  const pullToRefresh = usePullToRefresh(
    [refreshKeys.companies, refreshKeys.laborRoles],
    {
      refetch: [refreshUser],
    },
  );
  const multiCompany = (companies.data?.length ?? 0) > 1;
  const appVersion = Constants.expoConfig?.version ?? "—";
  const { preference: themePreference } = useThemePreference();
  const canHideSections = useCanManageHiddenSections();

  const rows: { key: string; label: string; value?: string; path: string }[] = [
    {
      key: "companies",
      label: t("settings.myCompanies"),
      value: primary?.legal_name,
      path: "/settings/companies",
    },
    {
      key: "payment-methods",
      label: t("settings.paymentMethods"),
      value: paymentMethods.data
        ? String(paymentMethods.data.length)
        : undefined,
      path: "/settings/payment-methods",
    },
    {
      key: "labor-roles",
      label: t("settings.laborRoles"),
      value: roles.data
        ? multiCompany && rolesCompany
          ? `${rolesCompany.legal_name} · ${roles.data.roles.length}`
          : String(roles.data.roles.length)
        : undefined,
      path: "/settings/labor-roles",
    },
    {
      key: "notifications",
      label: t("settings.notificationPrefs.title"),
      path: "/settings/notifications",
    },
    {
      key: "appearance",
      label: t("settings.appearance.title"),
      value: t(`settings.appearance.options.${themePreference}`),
      path: "/settings/appearance",
    },
    ...(canHideSections
      ? [
          {
            key: "hidden-sections",
            label: t("settings.hiddenSections.title"),
            value: multiCompany
              ? undefined
              : String(primary?.hidden_sections?.length ?? 0),
            path: "/settings/hidden-sections",
          },
        ]
      : []),
    {
      key: "join-company",
      label: t("settings.joinCompany"),
      path: "/join-company?another=1",
    },
    ...(superadmin
      ? [
          {
            key: "admin-companies",
            label: t("settings.adminCompanies"),
            path: "/settings/admin-companies",
          },
          {
            key: "users",
            label: t("settings.usersAdmin"),
            path: "/settings/users",
          },
        ]
      : []),
  ];

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("settings.title")} back />
      <ScrollView
        refreshControl={pullToRefresh}
        contentContainerClassName="px-4 pb-6 pt-3.5"
        contentContainerStyle={{ gap: 16 }}
      >
        <Card padded={false} className="overflow-hidden" testID="settings-list">
          {rows.map((row) => (
            <ListRow
              key={row.key}
              testID={`settings-${row.key}`}
              title={row.label}
              value={row.value}
              grouped
              chevron
              onPress={() => router.push(row.path)}
            />
          ))}
        </Card>
        {/* Language, here too: the avatar sheet was the only place to change it. */}
        <Card testID="settings-language">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-[14px] text-ink">
              {t("settings.language")}
            </Text>
            <LanguageChips />
          </View>
        </Card>
        <Card
          padded={false}
          className="overflow-hidden"
          testID="settings-about"
        >
          <ListRow
            title={t("settings.about")}
            subtitle={t("settings.version")}
            value={`v${appVersion}`}
            grouped
            testID="settings-version"
          />
        </Card>
        <LegalLinks />
        <Button
          label={t("home.signOut")}
          variant="danger"
          onPress={() => void signOut()}
          testID="home-sign-out"
        />
      </ScrollView>
    </View>
  );
}
