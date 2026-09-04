import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import i18n, { SUPPORTED_LOCALES, setLocale } from "@/i18n";
import type { SupportedLocale } from "@/i18n";

/** Settings hub: account, language, then the settings sections (admin ones only for superadmin). */
export default function SettingsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const superadmin = user?.permissions.includes("*:*") ?? false;
  const language = (SUPPORTED_LOCALES as readonly string[]).includes(
    i18n.language,
  )
    ? (i18n.language as SupportedLocale)
    : "en";

  const sections: { key: string; label: string; path: string }[] = [
    {
      key: "companies",
      label: t("settings.myCompanies"),
      path: "/settings/companies",
    },
    {
      key: "payment-methods",
      label: t("settings.paymentMethods"),
      path: "/settings/payment-methods",
    },
    {
      key: "labor-roles",
      label: t("settings.laborRoles"),
      path: "/settings/labor-roles",
    },
    {
      key: "persons-merge",
      label: t("settings.personsMerge"),
      path: "/settings/persons-merge",
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
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("tabs.settings")} />
      <ScrollView contentContainerClassName="p-4 pb-12">
        <Card className="mb-4">
          <Text className="text-xs text-muted-foreground">
            {t("settings.signedInAs")}
          </Text>
          <Text className="text-base text-primary" testID="settings-email">
            {user?.email}
          </Text>
          <Text className="mt-2 text-xs text-muted-foreground">
            {user?.roles.join(", ")}
          </Text>
        </Card>
        <Select<SupportedLocale>
          testID="settings-language"
          label={t("settings.language")}
          value={language}
          options={SUPPORTED_LOCALES.map((code) => ({
            value: code,
            label: t(`settings.languages.${code}`),
          }))}
          onChange={(code) => void setLocale(code)}
        />
        <Text className="mb-2 text-base font-semibold text-primary">
          {t("settings.sections")}
        </Text>
        {sections.map((section) => (
          <ListRow
            key={section.key}
            testID={`settings-${section.key}`}
            title={section.label}
            right={<Text className="text-lg text-muted-foreground">›</Text>}
            onPress={() => router.push(section.path)}
          />
        ))}
        <View className="h-4" />
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
