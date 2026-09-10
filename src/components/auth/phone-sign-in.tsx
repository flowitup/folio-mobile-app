import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import {
  FIELD,
  InkPill,
  LoginFrame,
  SignInErrorLine,
} from "@/components/auth/login-frame";
import { CODE_LENGTH, OtpCodeBoxes } from "@/components/auth/otp-code-boxes";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Eyebrow } from "@/components/ui/typography";
import { normalizePhone } from "@/lib/auth/phone-number";
import { INK_BLOCK, useTokens } from "@/theme/tokens";

const RESEND_SECONDS = 60;

/** Step 1: phone → "Send code"; step 2: the 6-digit code with a 60 s resend timer. */
export function PhoneSignIn({
  signup,
  modeSwitcher,
}: {
  signup: boolean;
  modeSwitcher: ReactNode;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();
  const { requestOtp, signInWithOtp } = useAuth();
  const [phoneInput, setPhoneInput] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  // The backend decides the code's lifetime (OTP_TTL_SECONDS) and reports it on
  // every request, so the sheet quotes what was actually sent rather than a
  // number that silently drifts from the server's.
  const [expiresInMinutes, setExpiresInMinutes] = useState(5);
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
  const canVerify =
    new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) && !submitting;

  async function sendCode() {
    if (!phone) return setError(t("login.invalidPhone"));
    setSubmitting(true);
    setError(null);
    try {
      const expiresIn = await requestOtp(phone);
      setExpiresInMinutes(Math.max(1, Math.round(expiresIn / 60)));
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

  async function verify(explicitCode?: string) {
    // Auto sign-in passes the code it just completed: reading it from state here
    // would still see the value from before that keystroke.
    const submitted = explicitCode ?? code;
    // The backend counts a wrong code against a 5-attempt limit, so never let an
    // auto sign-in and a button press of the same code both go out.
    if (submitting || !sentTo) return;
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(submitted)) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithOtp(sentTo, submitted);
    } catch (caught) {
      // Keep the digits: the user needs to see what was rejected.
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function changeNumber() {
    setSentTo(null);
    setCode("");
    setError(null);
  }

  if (sentTo === null) {
    return (
      <LoginFrame
        pill={
          <InkPill>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-ink-block-tile">
              <Text className="font-serif text-[17px] text-on-ink-block">
                F
              </Text>
            </View>
            <Text className="font-serif text-[17px] font-semibold text-on-ink-block">
              Folio
            </Text>
          </InkPill>
        }
        headline={t("login.title")}
        sub={t("login.subtitle")}
      >
        {modeSwitcher ? <View className="mb-5">{modeSwitcher}</View> : null}
        <Eyebrow className="mb-2">{t("login.phone")}</Eyebrow>
        <View className="mb-2 flex-row gap-2">
          <View className="h-[52px] flex-row items-center gap-1.5 rounded-[10px] border border-line-2 bg-paper-2 px-3">
            <Text className="font-sans-semibold text-[15px] text-ink">FR</Text>
            <Text className="font-mono text-[14px] text-muted">+33</Text>
          </View>
          <View className={`${FIELD} flex-1`}>
            <TextInput
              testID="login-phone"
              className="flex-1 font-mono text-[18px] text-ink"
              autoComplete="tel"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              placeholder="6 12 34 56 78"
              placeholderTextColor={tokens.muted2}
              value={phoneInput}
              onChangeText={setPhoneInput}
              onSubmitEditing={() => canSend && void sendCode()}
            />
          </View>
        </View>
        <Text className="mb-[18px] font-sans text-[12.5px] leading-[18px] text-muted">
          {t("login.phoneHint")}
        </Text>
        <SignInErrorLine error={error} />
        <Button
          testID="login-send-code"
          label={t("login.sendCode")}
          loading={submitting}
          disabled={!canSend}
          onPress={() => void sendCode()}
          className="h-[52px]"
        />
        {signup ? (
          <Pressable
            testID="login-signup"
            accessibilityRole="button"
            onPress={() => router.push("/signup")}
            className="mt-4 items-center"
            hitSlop={8}
          >
            <Text className="font-sans text-[14px] text-muted">
              {t("login.noAccount")}{" "}
              <Text className="font-sans-semibold text-ink underline">
                {t("login.createAccount")}
              </Text>
            </Text>
          </Pressable>
        ) : null}
      </LoginFrame>
    );
  }

  return (
    <LoginFrame
      pill={
        <InkPill
          onPress={changeNumber}
          testID="login-change-phone"
          accessibilityLabel={t("login.changePhone")}
        >
          <Icon name="chevron-left" size={18} color={INK_BLOCK.text} />
          <Text className="font-sans-medium text-[14px] text-on-ink-block">
            {t("login.changePhone")}
          </Text>
        </InkPill>
      }
      headline={t("login.codeTitle")}
      sub={
        <Trans
          i18nKey="login.codeSentTo"
          values={{ phone: sentTo }}
          components={{
            mono: (
              <Text
                testID="login-code-sent"
                className="font-mono text-[14.5px] text-on-ink-block"
              />
            ),
          }}
        />
      }
    >
      <Eyebrow className="mb-2">{t("login.code")}</Eyebrow>
      <OtpCodeBoxes
        value={code}
        onChange={setCode}
        onComplete={(completed) => void verify(completed)}
        invalid={error !== null}
        disabled={submitting}
        positionLabel={(position) =>
          t("login.codeDigit", { position, total: CODE_LENGTH })
        }
      />
      {error === null ? (
        <View className="mb-[18px] mt-3 flex-row items-center justify-between">
          <Pressable
            testID="login-resend"
            accessibilityRole="button"
            disabled={secondsLeft > 0 || submitting}
            onPress={() => void sendCode()}
            hitSlop={12}
          >
            <Text
              className={`font-sans text-[12.5px] ${secondsLeft > 0 ? "text-muted-2" : "text-ink underline"}`}
            >
              {secondsLeft > 0
                ? t("login.resendIn", { seconds: secondsLeft })
                : t("login.resend")}
            </Text>
          </Pressable>
          <Text className="font-sans text-[12.5px] text-muted">
            {t("login.codeExpires", { minutes: expiresInMinutes })}
          </Text>
        </View>
      ) : (
        <View className="mb-[18px] mt-3">
          <SignInErrorLine error={error} />
          <Pressable
            testID="login-resend"
            accessibilityRole="button"
            disabled={secondsLeft > 0 || submitting}
            onPress={() => void sendCode()}
            hitSlop={12}
          >
            <Text
              className={`font-sans-semibold text-[13px] ${secondsLeft > 0 ? "text-muted-2" : "text-ink underline"}`}
            >
              {secondsLeft > 0
                ? t("login.resendIn", { seconds: secondsLeft })
                : t("login.resend")}
            </Text>
          </Pressable>
        </View>
      )}
      <Button
        testID="login-verify"
        label={error === null ? t("login.verify") : t("login.retry")}
        loading={submitting}
        disabled={!canVerify}
        onPress={() => void verify()}
        className="h-[52px]"
      />
      <Text className="mt-4 text-center font-sans text-[12.5px] text-muted">
        {t("login.autoSubmitHint")}
      </Text>
    </LoginFrame>
  );
}

/** Email + password on the same ink board, unchanged behaviour. */
