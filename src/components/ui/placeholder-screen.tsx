import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

/** Stand-in for a screen whose feature phase has not landed yet. */
export function PlaceholderScreen({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <View
      className="flex-1 items-center justify-center bg-paper px-6"
      testID={`placeholder-${name}`}
    >
      <Text className="mb-2 font-sans-semibold text-lg text-ink">{name}</Text>
      <Text className="text-center font-sans text-muted">
        {t("common.comingSoon")}
      </Text>
    </View>
  );
}
