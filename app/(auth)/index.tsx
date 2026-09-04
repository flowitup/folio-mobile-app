import { useEffect, useMemo, useState } from "react";
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

import { loginModesFor, useAuthConfig } from "@/auth/auth-config";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/typography";
import { normalizePhone } from "@/lib/auth/phone-number";
import { useTokens } from "@/theme/tokens";

type Mode = "phone" | "email";

const FIELD =
  "h-12 flex-row items-center rounded-[10px] border border-line-2 bg-card px-3.5";
const RESEND_SECONDS = 60;

/**
 * Đăng nhập Folio: ink "F" tile, Fraunces title. Phone (SMS code) is the app's sign-in; email +
 * password appears only when the backend's LOGIN_MODE activates it (`email` or `both`).
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const config = useAuthConfig();
  const modes = useMemo(
    () => loginModesFor(config.data?.login_mode),
    [config.data?.login_mode],
  );
  const [chosen, setChosen] = useState<Mode>("phone");
  const mode: Mode = modes.includes(chosen) ? chosen : modes[0];

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
        <Text className="mb-6 font-sans text-[14px] text-muted">
          {t("login.subtitle")}
        </Text>

        {modes.length > 1 ? (
          <View className="mb-6">
            <Segmented<Mode>
              testID="login-mode"
              options={modes.map((value) => ({
                value,
                label: t(`login.mode.${value}`),
              }))}
              value={mode}
              onChange={setChosen}
            />
          </View>
        ) : null}

        {mode === "phone" ? <PhoneForm /> : <EmailForm />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Step 1: phone → "Send code"; step 2: 6-digit code with a 60 s resend timer and "Change number". */
function PhoneForm() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { requestOtp, signInWithOtp } = useAuth();
  const [phoneInput, setPhoneInput] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tick once a second while the resend timer runs.
  useEffect(() => {
    if (resendAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const phone = normalizePhone(phoneInput);
  const secondsLeft =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const canSend = phone !== null && !submitting;
  const canVerify = /^\d{6}$/.test(code) && !submitting;

  async function sendCode() {
    if (!phone) return setError(t("login.invalidPhone"));
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(phone);
      setSentTo(phone);
      setCode("");
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setNow(Date.now());
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    if (!sentTo || !canVerify) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithOtp(sentTo, code);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo === null) {
    return (
      <View>
        <Eyebrow className="mb-1.5">{t("login.phone")}</Eyebrow>
        <View className={`${FIELD} mb-1.5`}>
          <TextInput
            testID="login-phone"
            className="flex-1 font-sans text-base text-ink"
            autoComplete="tel"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="+84 912 345 678"
            placeholderTextColor={tokens.muted2}
            value={phoneInput}
            onChangeText={setPhoneInput}
            onSubmitEditing={() => canSend && void sendCode()}
          />
        </View>
        <Text className="mb-6 font-sans text-[12px] text-muted">
          {t("login.phoneHint")}
        </Text>
        <ErrorLine error={error} />
        <Button
          testID="login-send-code"
          label={t("login.sendCode")}
          loading={submitting}
          disabled={!canSend}
          onPress={() => void sendCode()}
        />
      </View>
    );
  }

  return (
    <View>
      <Text
        testID="login-code-sent"
        className="mb-4 font-sans text-[14px] text-ink"
      >
        {t("login.codeSentTo", { phone: sentTo })}
      </Text>
      <Eyebrow className="mb-1.5">{t("login.code")}</Eyebrow>
      <View className={`${FIELD} mb-6`}>
        <TextInput
          testID="login-code"
          className="flex-1 font-mono text-[22px] tracking-[6px] text-ink"
          autoComplete="sms-otp"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={6}
          placeholder="••••••"
          placeholderTextColor={tokens.muted2}
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
          onSubmitEditing={() => canVerify && void verify()}
          autoFocus
        />
      </View>
      <ErrorLine error={error} />
      <Button
        testID="login-verify"
        label={t("login.verify")}
        loading={submitting}
        disabled={!canVerify}
        onPress={() => void verify()}
      />
      <View className="mt-[18px] flex-row items-center justify-between">
        <Pressable
          testID="login-resend"
          accessibilityRole="button"
          disabled={secondsLeft > 0 || submitting}
          onPress={() => void sendCode()}
          hitSlop={8}
        >
          <Text
            className={`font-sans text-[13px] ${secondsLeft > 0 ? "text-muted-2" : "text-ink"}`}
          >
            {secondsLeft > 0
              ? t("login.resendIn", { seconds: secondsLeft })
              : t("login.resend")}
          </Text>
        </Pressable>
        <Pressable
          testID="login-change-phone"
          accessibilityRole="button"
          onPress={() => {
            setSentTo(null);
            setCode("");
            setError(null);
            setResendAt(null);
          }}
          hitSlop={8}
        >
          <Text className="font-sans text-[13px] text-ink">
            {t("login.changePhone")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Email + password, unchanged behaviour. */
function EmailForm() {
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
    <View>
      <Eyebrow className="mb-1.5">{t("login.email")}</Eyebrow>
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

      <Eyebrow className="mb-1.5">{t("login.password")}</Eyebrow>
      <View className={`${FIELD} mb-6`}>
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

      <ErrorLine error={error} />
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
    </View>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <Text testID="login-error" className="mb-4 font-sans text-sm text-negative">
      {t("login.failed", { message: error })}
    </Text>
  );
}
