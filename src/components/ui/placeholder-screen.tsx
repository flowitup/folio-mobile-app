import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

/** Stand-in for a screen whose feature phase has not landed yet. */
export function PlaceholderScreen({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <View
      className="flex-1 items-center justify-center bg-white px-6"
      testID={`placeholder-${name}`}
    >
      <Text className="mb-2 text-lg font-semibold text-primary">{name}</Text>
      <Text className="text-center text-muted-foreground">
        {t("common.comingSoon")}
      </Text>
    </View>
  );
}
