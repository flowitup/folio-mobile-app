import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { ChangePhoneForm } from "@/components/account/change-phone-form";
import { ScreenHeader } from "@/components/ui/screen-header";

/** Settings → Phone number: move the account to a new sign-in number, proven by an SMS code. */
export default function ChangePhoneScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("account.phone.title")} back />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
        >
          <ChangePhoneForm
            onDone={() =>
              router.canGoBack() ? router.back() : router.replace("/settings")
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
