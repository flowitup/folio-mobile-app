import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { Icon } from "@/components/ui/icon";
import { ScreenTitle } from "@/components/ui/typography";
import { useTokens } from "@/theme/tokens";

/**
 * The reserved-area card a member without labor or pay access sees where a manager sees the
 * project's workers, pay or expenses. The backend answers those lists with nothing for them, and
 * drawing that as "0 €" or "no worker on this site" reads as an empty project.
 */
export function RestrictedNotice({ message }: { message: string }) {
  const { t } = useTranslation();
  const tokens = useTokens();
  return (
    <View
      testID="restricted-area"
      className="items-center gap-2 rounded-xl border border-line bg-card px-6 py-8"
    >
      <Icon name="lock" size={22} color={tokens.muted} />
      <Text className="text-center font-sans-semibold text-[15px] text-ink">
        {t("labor.restricted.title")}
      </Text>
      <Text className="text-center font-sans text-[13px] leading-[19px] text-muted">
        {message}
      </Text>
    </View>
  );
}

/** A whole tab given over to `RestrictedNotice`, under the project top bar and the tab title. */
export function RestrictedArea({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View className="flex-1 bg-paper">
      <ProjectTopBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-3.5"
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
      >
        <ScreenTitle>{title}</ScreenTitle>
        <RestrictedNotice message={message} />
      </ScrollView>
    </View>
  );
}
