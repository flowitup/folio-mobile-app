import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { useShell } from "@/components/shell/shell-context";
import { ShellSheet } from "@/components/shell/shell-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import i18n, { SUPPORTED_LOCALES, setLocale } from "@/i18n";
import type { SupportedLocale } from "@/i18n";
import { useTokens } from "@/theme/tokens";

function currentLocale(): SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLocale)
    : "en";
}

/** Avatar sheet: who is signed in, Cài đặt → settings hub, Ngôn ngữ (inline picker), Đăng xuất. */
export function AccountSheet() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { sheet, closeSheet } = useShell();
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const open = sheet === "account";
  const locale = currentLocale();

  return (
    <ShellSheet open={open} testID="account-sheet">
      <View className="flex-row items-center gap-3 pb-3.5 pt-1">
        <Avatar name={user?.email} size={40} />
        <View className="min-w-0 flex-1">
          <Text
            className="font-sans-semibold text-[15px] text-ink"
            numberOfLines={1}
            testID="account-email"
          >
            {user?.email}
          </Text>
          <Text className="font-sans text-xs text-muted" numberOfLines={1}>
            {(user?.roles ?? []).join(" · ")}
          </Text>
        </View>
      </View>
      <View className="overflow-hidden rounded-xl border border-line bg-card">
        <Pressable
          testID="account-settings"
          accessibilityRole="button"
          onPress={() => {
            closeSheet();
            router.push("/settings");
          }}
          className="flex-row items-center justify-between border-b border-line px-3.5 py-[13px] active:opacity-70"
        >
          <Text className="font-sans text-[14px] text-ink">
            {t("settings.title")}
          </Text>
          <Text className="font-sans text-xs text-muted">
            {t("shell.settingsSub")}
          </Text>
        </Pressable>
        <Pressable
          testID="account-language"
          accessibilityRole="button"
          onPress={() => setPickingLanguage((current) => !current)}
          className="flex-row items-center justify-between px-3.5 py-[13px] active:opacity-70"
        >
          <Text className="font-sans text-[14px] text-ink">
            {t("settings.language")}
          </Text>
          <Text className="font-sans text-[13px] text-muted">
            {t(`settings.languages.${locale}`)}
          </Text>
        </Pressable>
        {pickingLanguage
          ? SUPPORTED_LOCALES.map((code) => (
              <Pressable
                key={code}
                testID={`account-language-${code}`}
                accessibilityRole="button"
                accessibilityState={{ selected: code === locale }}
                onPress={() => {
                  void setLocale(code);
                  setPickingLanguage(false);
                }}
                className="flex-row items-center justify-between border-t border-line bg-paper-2 px-3.5 py-[11px] active:opacity-70"
              >
                <Text className="font-sans text-[14px] text-ink">
                  {t(`settings.languages.${code}`)}
                </Text>
                {code === locale ? (
                  <Icon name="check" size={16} color={tokens.ink} />
                ) : null}
              </Pressable>
            ))
          : null}
      </View>
      <Pressable
        testID="account-sign-out"
        accessibilityRole="button"
        onPress={() => {
          closeSheet();
          void signOut();
        }}
        className="mt-3 px-3.5 py-3 active:opacity-70"
      >
        <Text className="font-sans-medium text-[14px] text-negative">
          {t("home.signOut")}
        </Text>
      </Pressable>
    </ShellSheet>
  );
}
