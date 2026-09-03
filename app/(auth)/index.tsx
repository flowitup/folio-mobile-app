import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-6"
      >
        <Text className="mb-8 text-3xl font-bold text-neutral-900">
          {t("login.title")}
        </Text>

        <Text className="mb-1 text-sm text-neutral-600">
          {t("login.email")}
        </Text>
        <TextInput
          testID="login-email"
          className="mb-4 rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />

        <Text className="mb-1 text-sm text-neutral-600">
          {t("login.password")}
        </Text>
        <TextInput
          testID="login-password"
          className="mb-6 rounded-lg border border-neutral-300 px-4 py-3 text-base text-neutral-900"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={canSubmit ? handleSubmit : undefined}
        />

        {error ? (
          <Text testID="login-error" className="mb-4 text-sm text-red-600">
            {t("login.failed", { message: error })}
          </Text>
        ) : null}

        <Pressable
          testID="login-submit"
          disabled={!canSubmit}
          onPress={handleSubmit}
          className={`items-center rounded-lg py-3 ${canSubmit ? "bg-neutral-900" : "bg-neutral-300"}`}
        >
          <Text className="text-base font-semibold text-white">
            {submitting ? t("common.loading") : t("login.submit")}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
