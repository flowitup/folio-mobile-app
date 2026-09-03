import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { PlaceholderScreen } from "@/components/ui/placeholder-screen";
import { ScreenHeader } from "@/components/ui/screen-header";

export default function LibraryTab() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("tabs.library")} />
      <PlaceholderScreen name={t("tabs.library")} />
    </View>
  );
}
