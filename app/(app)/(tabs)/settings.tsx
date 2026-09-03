import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import i18n, { SUPPORTED_LOCALES, setLocale } from "@/i18n";
import type { SupportedLocale } from "@/i18n";

export default function SettingsTab() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const language = (SUPPORTED_LOCALES as readonly string[]).includes(
    i18n.language,
  )
    ? (i18n.language as SupportedLocale)
    : "en";

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("tabs.settings")} />
      <View className="p-4">
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
        <Button
          label={t("home.signOut")}
          variant="danger"
          onPress={() => void signOut()}
          testID="home-sign-out"
        />
      </View>
    </View>
  );
}
