import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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
import { FrenchPhoneField } from "@/components/auth/french-phone-field";
import { CODE_LENGTH, OtpCodeBoxes } from "@/components/auth/otp-code-boxes";
import { LegalLinks } from "@/components/legal-links";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";
import { AuthRequestError, isResendGap } from "@/lib/auth/auth-error-message";
import { formatFrenchPhone, normalizePhone } from "@/lib/auth/phone-number";
import { useTokens } from "@/theme/tokens";
import { LanguageChips } from "@/components/language-chips";

/** "+33612345678" (the sign-in screen's `?phone=`) as the field shows it: "6 12 34 56 78". */
function prefilledPhone(param: string | string[] | undefined): string {
  const formatted = formatFrenchPhone(typeof param === "string" ? param : "");
  return formatted.startsWith("+33 ") ? formatted.slice(4) : "";
}

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
  // Sent by the sign-in screen when a code was refused for a number with no account yet (D1).
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState(() =>
    prefilledPhone(phoneParam),
  );
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The backend's per-number gap is shared with sign-in: a sign-in code asked for this number a
  // moment ago makes it refuse a sign-up code until then. A wait, not a failure.
  const [gap, setGap] = useState<{ phone: string; until: number } | null>(null);

  // Tick while a countdown runs, and stop when it ends: a live interval would re-render the
  // code boxes under the user's typing.
  const deadline = Math.max(resendAt ?? 0, gap?.until ?? 0);
  useEffect(() => {
    if (deadline <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline, now]);

  const normalized = normalizePhone(phoneInput);
  const secondsLeft =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const gapSeconds =
    gap !== null && gap.phone === normalized
      ? Math.max(0, Math.ceil((gap.until - now) / 1000))
      : 0;

  async function sendCode() {
    if (!normalized) return setError(t("login.invalidPhone"));
    if (normalized === phone && secondsLeft > 0) {
      // "Change number" then the same number again inside the backend's per-number cooldown:
      // the code already texted is still valid, and asking for another only answers 429 and
      // strands the user on this step (the sign-in screen's hasCodeInFlight rule).
      setError(null);
      setStep("code");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestSignupOtp(normalized);
      setPhone(normalized);
      setCode("");
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setNow(Date.now());
      setGap(null);
      setStep("code");
    } catch (caught) {
      if (isResendGap(caught)) {
        const at = Date.now();
        setGap({
          phone: normalized,
          until: at + (caught.retryAfter ?? RESEND_SECONDS) * 1000,
        });
        setNow(at);
        return;
      }
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  /** The code goes to the backend with the name, so a full row moves on to the name step. */
  function codeComplete(completed: string) {
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(completed)) return;
    setError(null);
    setStep("name");
  }

  async function create() {
    if (!phone || !/^\d{6}$/.test(code) || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await signUpWithOtp(phone, code, name.trim());
    } catch (caught) {
      setError((caught as Error).message);
      // A wrong or expired code is a 401 — send the user back to the code step. The status
      // is what decides it: the message is translated, so matching words in it left a
      // Vietnamese (the default locale) user stranded on the name step.
      // The boxes are emptied so that typing the right code moves on again by itself.
      if (caught instanceof AuthRequestError && caught.status === 401) {
        setCode("");
        setStep("code");
      }
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
            {/* The same FR +33 field as sign-in: the dial code is stated, not guessed. */}
            <FrenchPhoneField
              testID="signup-phone"
              value={phoneInput}
              onChangeText={setPhoneInput}
              onSubmitEditing={() => void sendCode()}
              autoFocus
            />
            <Text className="mb-6 font-sans text-[12px] text-muted">
              {t("login.phoneHint")}
            </Text>
            {gapSeconds > 0 ? (
              <Text
                testID="signup-wait"
                accessibilityLiveRegion="polite"
                className="mb-4 font-sans text-[13px] text-ink"
              >
                {t("signup.waitBeforeCode", { seconds: gapSeconds })}
              </Text>
            ) : null}
            <ErrorLine error={error} />
            <Button
              testID="signup-send-code"
              label={t("login.sendCode")}
              loading={submitting}
              // Live for any entry: pressing says what is wrong with a non-French number.
              disabled={!phoneInput.trim() || submitting || gapSeconds > 0}
              onPress={() => void sendCode()}
            />
          </View>
        ) : null}

        {step === "code" ? (
          <View>
            <Text className="mb-4 font-sans text-[14px] text-ink">
              <Trans
                i18nKey="login.codeSentTo"
                values={{ phone: formatFrenchPhone(phone) }}
                components={{
                  mono: (
                    <Text
                      testID="signup-code-sent"
                      className="font-mono text-[14px] text-ink"
                    />
                  ),
                }}
              />
            </Text>
            <Eyebrow className="mb-1.5">{t("login.code")}</Eyebrow>
            {/* The sign-in screen's six boxes: a full row moves on by itself. */}
            <View className="mb-6">
              <OtpCodeBoxes
                testID="signup-code"
                value={code}
                onChange={setCode}
                onComplete={codeComplete}
                invalid={error !== null}
                positionLabel={(position) =>
                  t("login.codeDigit", { position, total: CODE_LENGTH })
                }
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
        <LanguageChips className="mt-4" />
        <LegalLinks className="mt-3" />
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
