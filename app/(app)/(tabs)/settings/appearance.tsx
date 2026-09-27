import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  THEME_PREFERENCES,
  useThemePreference,
} from "@/theme/theme-preference";
import { useTokens } from "@/theme/tokens";

/**
 * Settings → Appearance: light, dark, or follow the device.
 *
 * The choice takes effect on the tap — this screen repaints under the user's
 * finger, which is the confirmation, so there is nothing to save.
 */
export default function AppearanceScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { preference, setPreference } = useThemePreference();

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("settings.appearance.title")} back />
      <ScrollView contentContainerClassName="p-4 gap-3">
        <Text className="px-1 font-sans text-[13px] text-muted">
          {t("settings.appearance.subtitle")}
        </Text>
        <Card className="overflow-hidden p-0">
          {THEME_PREFERENCES.map((option, index) => (
            <Pressable
              key={option}
              testID={`appearance-${option}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: option === preference }}
              onPress={() => setPreference(option)}
              className={`flex-row items-center justify-between px-3.5 py-[13px] active:opacity-70 ${
                index > 0 ? "border-t border-line" : ""
              }`}
            >
              <View className="min-w-0 flex-1 pr-3">
                <Text className="font-sans text-[14px] text-ink">
                  {t(`settings.appearance.options.${option}`)}
                </Text>
                <Text className="font-sans text-xs text-muted">
                  {t(`settings.appearance.hints.${option}`)}
                </Text>
              </View>
              {option === preference ? (
                <Icon name="check" size={16} color={tokens.ink} />
              ) : null}
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
