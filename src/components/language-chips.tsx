import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { SUPPORTED_LOCALES, activeLocale, setLocale } from "@/i18n";

/**
 * VI · FR · EN, before the tab shell exists: sign-in, sign-up, onboarding and the waiting
 * screen start in Vietnamese, and a French worker had no way to read them in French.
 */
export function LanguageChips({ className = "" }: { className?: string }) {
  // Re-renders on a language change, so the selected chip follows.
  const { t } = useTranslation();
  const current = activeLocale();
  return (
    <View
      testID="language-chips"
      accessibilityRole="radiogroup"
      accessibilityLabel={t("settings.language")}
      className={`flex-row items-center justify-center gap-2 ${className}`}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const selected = code === current;
        return (
          <Pressable
            key={code}
            testID={`language-${code}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`settings.languages.${code}`)}
            onPress={() => void setLocale(code)}
            hitSlop={6}
            className={`rounded-full border px-3 py-1 ${selected ? "border-ink bg-ink" : "border-line-2 bg-card"}`}
          >
            <Text
              className={`font-sans-semibold text-[12px] ${selected ? "text-on-ink" : "text-muted"}`}
            >
              {code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
