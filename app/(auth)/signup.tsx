import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { normalizePhone } from "@/lib/auth/phone-number";
import { useTokens } from "@/theme/tokens";

type Step = "phone" | "code" | "name";

const FIELD =
  "h-12 flex-row items-center rounded-[10px] border border-line-2 bg-card px-3.5";
const RESEND_SECONDS = 60;

/**
 * Create a profile with a phone number: phone → SMS code → username. Signing up signs the
 * user in; without a company they land on the "join a company" screen next.
 */
export default function SignupScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();
  const { requestSignupOtp, signUpWithOtp } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const normalized = normalizePhone(phoneInput);
  const secondsLeft =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function sendCode() {
    if (!normalized) return setError(t("login.invalidPhone"));
    setSubmitting(true);
    setError(null);
    try {
      await requestSignupOtp(normalized);
      setPhone(normalized);
      setCode("");
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setNow(Date.now());
      setStep("code");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function create() {
    if (!phone || !/^\d{6}$/.test(code) || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await signUpWithOtp(phone, code, name.trim());
    } catch (caught) {
      setError((caught as Error).message);
      // A wrong code sends the user back to the code step.
      if (/code/i.test((caught as Error).message)) setStep("code");
    } finally {
      setSubmitting(false);
    }
  }

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
          {t("signup.title")}
        </Text>
        <Text className="mb-8 font-sans text-[14px] text-muted">
          {t(`signup.subtitle.${step}`)}
        </Text>

        {step === "phone" ? (
          <View>
            <Eyebrow className="mb-1.5">{t("login.phone")}</Eyebrow>
            <View className={`${FIELD} mb-1.5`}>
              <TextInput
                testID="signup-phone"
                className="flex-1 font-sans text-base text-ink"
                autoComplete="tel"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                placeholder="06 12 34 56 78"
                placeholderTextColor={tokens.muted2}
                value={phoneInput}
                onChangeText={setPhoneInput}
                onSubmitEditing={() => normalized && void sendCode()}
                autoFocus
              />
            </View>
            <Text className="mb-6 font-sans text-[12px] text-muted">
              {t("login.phoneHint")}
            </Text>
            <ErrorLine error={error} />
            <Button
              testID="signup-send-code"
              label={t("login.sendCode")}
              loading={submitting}
              disabled={!normalized || submitting}
              onPress={() => void sendCode()}
            />
          </View>
        ) : null}

        {step === "code" ? (
          <View>
            <Text className="mb-4 font-sans text-[14px] text-ink">
              {t("login.codeSentTo", { phone })}
            </Text>
            <Eyebrow className="mb-1.5">{t("login.code")}</Eyebrow>
            <View className={`${FIELD} mb-6`}>
              <TextInput
                testID="signup-code"
                className="flex-1 font-mono text-[22px] tracking-[6px] text-ink"
                autoComplete="sms-otp"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor={tokens.muted2}
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
                onSubmitEditing={() => /^\d{6}$/.test(code) && setStep("name")}
                autoFocus
              />
            </View>
            <ErrorLine error={error} />
            <Button
              testID="signup-code-next"
              label={t("signup.next")}
              disabled={!/^\d{6}$/.test(code)}
              onPress={() => {
                setError(null);
                setStep("name");
              }}
            />
            <View className="mt-[18px] flex-row items-center justify-between">
              <Pressable
                testID="signup-resend"
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
                testID="signup-change-phone"
                accessibilityRole="button"
                onPress={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
                hitSlop={8}
              >
                <Text className="font-sans text-[13px] text-ink">
                  {t("login.changePhone")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {step === "name" ? (
          <View>
            <Eyebrow className="mb-1.5">{t("signup.nameLabel")}</Eyebrow>
            <View className={`${FIELD} mb-1.5`}>
              <TextInput
                testID="signup-name"
                className="flex-1 font-sans text-base text-ink"
                autoComplete="name"
                textContentType="name"
                maxLength={80}
                placeholder={t("signup.namePlaceholder")}
                placeholderTextColor={tokens.muted2}
                value={name}
                onChangeText={setName}
                onSubmitEditing={() => void create()}
                autoFocus
              />
            </View>
            <Text className="mb-6 font-sans text-[12px] text-muted">
              {t("signup.nameHint")}
            </Text>
            <ErrorLine error={error} />
            <Button
              testID="signup-create"
              label={t("signup.create")}
              loading={submitting}
              disabled={!name.trim() || submitting}
              onPress={() => void create()}
            />
          </View>
        ) : null}

        <Pressable
          testID="signup-back-to-login"
          accessibilityRole="button"
          onPress={() => router.back()}
          className="mt-[18px] items-center"
          hitSlop={8}
        >
          <Text className="font-sans text-[13px] text-muted">
            {t("signup.haveAccount")}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Text
      testID="signup-error"
      className="mb-4 font-sans text-sm text-negative"
    >
      {error}
    </Text>
  );
}
