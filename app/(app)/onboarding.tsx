import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";

/**
 * Onboarding hub — a signed-in user attached to no company lands here first (see the gate in
 * `app/(app)/_layout.tsx`): "Tạo công ty" (start a company as its admin, D1) or "Nhập mã tham
 * gia" (join one with the code an admin shared). Both flows continue in their own screen.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 justify-center px-7 pb-10">
        <View className="mb-7 h-11 w-11 items-center justify-center rounded-xl bg-ink">
          <Text className="font-serif text-2xl text-on-ink">F</Text>
        </View>
        <Text className="mb-1.5 font-serif text-[32px] tracking-[-0.32px] text-ink">
          {t("onboarding.title")}
        </Text>
        <Text className="mb-8 font-sans text-[14px] text-muted">
          {t("onboarding.subtitle")}
        </Text>

        <Eyebrow className="mb-1.5">{t("onboarding.chooseLabel")}</Eyebrow>
        <Button
          testID="onboarding-create"
          label={t("onboarding.createOption")}
          className="mb-3"
          onPress={() => router.push("/onboarding-create")}
        />
        <Button
          testID="onboarding-join"
          label={t("onboarding.joinOption")}
          variant="secondary"
          onPress={() => router.push("/join-company")}
        />

        <Pressable
          testID="onboarding-sign-out"
          accessibilityRole="button"
          onPress={() => void signOut()}
          hitSlop={8}
          className="mt-[18px] self-start"
        >
          <Text className="font-sans text-[13px] text-negative">
            {t("home.signOut")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
