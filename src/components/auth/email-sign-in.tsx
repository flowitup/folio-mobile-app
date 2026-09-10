import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import {
  FIELD,
  InkPill,
  LoginFrame,
  SignInErrorLine,
} from "@/components/auth/login-frame";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";
import { useTokens } from "@/theme/tokens";

/** Email + password on the same ink board, unchanged behaviour. */
export function EmailSignIn({ modeSwitcher }: { modeSwitcher: ReactNode }) {
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

  return (
    <LoginFrame
      pill={
        <InkPill>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-ink-block-tile">
            <Text className="font-serif text-[17px] text-on-ink-block">F</Text>
          </View>
          <Text className="font-serif text-[17px] font-semibold text-on-ink-block">
            Folio
          </Text>
        </InkPill>
      }
      headline={t("login.title")}
      sub={t("login.emailSubtitle")}
    >
      {modeSwitcher ? <View className="mb-5">{modeSwitcher}</View> : null}
      <Eyebrow className="mb-2">{t("login.email")}</Eyebrow>
      <View className={`${FIELD} mb-4`}>
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

      <Eyebrow className="mb-2">{t("login.password")}</Eyebrow>
      <View className={`${FIELD} mb-5`}>
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

      <SignInErrorLine error={error} />
      <Button
        testID="login-submit"
        label={t("login.submit")}
        loading={submitting}
        disabled={!canSubmit}
        onPress={() => void handleSubmit()}
        className="h-[52px]"
      />
      <Text className="mt-4 text-center font-sans text-[12.5px] text-muted">
        {t("login.forgot")}
      </Text>
    </LoginFrame>
  );
}
