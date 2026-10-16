import { useTranslation } from "react-i18next";
import { Linking, Pressable, Text, View } from "react-native";

import { WEB_BASE_URL } from "@/config/env";

/** The web's locale prefix for the app's language (the legal pages exist under each). */
function webLocale(language: string | undefined): string {
  const code = (language ?? "").slice(0, 2).toLowerCase();
  return ["fr", "en", "vi"].includes(code) ? code : "fr";
}

/**
 * Support and privacy policy, opened in the browser: for someone stuck at sign-in (no SMS, no
 * account) as much as for the stores' required privacy link.
 */
export function LegalLinks({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const base = `${WEB_BASE_URL}/${webLocale(i18n.language)}/legal`;
  const link = (path: string, label: string, testID: string) => (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      onPress={() => void Linking.openURL(`${base}/${path}`)}
      hitSlop={8}
    >
      <Text className="font-sans text-[12.5px] text-muted underline">
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View
      testID="legal-links"
      className={`flex-row items-center justify-center gap-3 ${className}`}
    >
      {link("support", t("legal.support"), "legal-support")}
      <Text className="font-sans text-[12.5px] text-muted">·</Text>
      {link("privacy", t("legal.privacy"), "legal-privacy")}
    </View>
  );
}
