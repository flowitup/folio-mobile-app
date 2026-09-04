import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";
import { useTokens } from "@/theme/tokens";

/** Đăng nhập Folio: ink "F" tile, Fraunces title, eyebrow-labelled fields, ink button. */
export default function LoginScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    email.trim().length > 0 && password.length >= 8 && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const field =
    "h-12 flex-row items-center rounded-[10px] border border-line-2 bg-card px-3.5";

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-7 pb-10"
      >
        <View className="mb-7 h-11 w-11 items-center justify-center rounded-xl bg-ink">
          <Text className="font-serif text-2xl text-on-ink">F</Text>
        </View>
        <Text className="mb-1.5 font-serif text-[32px] tracking-[-0.32px] text-ink">
          {t("login.title")}
        </Text>
        <Text className="mb-8 font-sans text-[14px] text-muted">
          {t("login.subtitle")}
        </Text>

        <Eyebrow className="mb-1.5">{t("login.email")}</Eyebrow>
        <View className={`${field} mb-4`}>
          <TextInput
            testID="login-email"
            className="flex-1 font-sans text-base text-ink"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholderTextColor={tokens.muted2}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <Eyebrow className="mb-1.5">{t("login.password")}</Eyebrow>
        <View className={`${field} mb-6`}>
          <TextInput
            testID="login-password"
            className="flex-1 font-sans text-base text-ink"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            placeholderTextColor={tokens.muted2}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => canSubmit && void handleSubmit()}
          />
          <Pressable
            testID="login-toggle-password"
            accessibilityRole="button"
            onPress={() => setShowPassword((current) => !current)}
            hitSlop={8}
          >
            <Text className="font-sans text-xs text-muted">
              {showPassword ? t("login.hide") : t("login.show")}
            </Text>
          </Pressable>
        </View>

        {error ? (
          <Text
            testID="login-error"
            className="mb-4 font-sans text-sm text-negative"
          >
            {t("login.failed", { message: error })}
          </Text>
        ) : null}

        <Button
          testID="login-submit"
          label={t("login.submit")}
          loading={submitting}
          disabled={!canSubmit}
          onPress={() => void handleSubmit()}
        />
        <Text className="mt-[18px] text-center font-sans text-[13px] text-muted">
          {t("login.forgot")}
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
