import { useTranslation } from "react-i18next";
import { Linking, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";

/** Blocking screen for a build below the server's minimum version: the only way out is to update. */
export function UpdateRequired({
  url,
  version,
}: {
  url: string;
  version: string;
}) {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View
        className="flex-1 justify-center px-7 pb-10"
        testID="update-required"
      >
        <Text className="mb-3 font-serif text-[26px] leading-[29px] text-ink">
          {t("updateRequired.title")}
        </Text>
        <Text className="mb-8 font-sans text-base text-muted">
          {t("updateRequired.body")}
        </Text>
        {url ? (
          <Button
            label={t("updateRequired.action")}
            onPress={() => void Linking.openURL(url)}
            testID="update-required-action"
          />
        ) : null}
        <Text className="mt-6 font-sans text-sm text-muted">
          {t("updateRequired.hint", { version })}
        </Text>
      </View>
    </SafeAreaView>
  );
}
