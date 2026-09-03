import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { PlaceholderScreen } from "@/components/ui/placeholder-screen";
import { ScreenHeader } from "@/components/ui/screen-header";

export default function BillingTab() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("tabs.billing")} />
      <PlaceholderScreen name={t("tabs.billing")} />
    </View>
  );
}
