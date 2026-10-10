import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { FrenchPhoneField } from "@/components/auth/french-phone-field";
import { CODE_LENGTH, OtpCodeBoxes } from "@/components/auth/otp-code-boxes";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { Eyebrow } from "@/components/ui/typography";
import { normalizePhone } from "@/lib/auth/phone-number";
import { useCodeExpiry } from "@/lib/auth/use-code-expiry";
import { useTokens } from "@/theme/tokens";

// Matches the backend's per-number resend throttle, as on sign-in.
const RESEND_SECONDS = 60;
const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);

/**
 * Move the account to a new sign-in number. Step 1 texts a code to the NEW number; step 2 takes
 * that code (same boxes as sign-in, auto-submitted at 6 digits) and swaps the number. The session
 * stays valid; `onDone` runs once the number has changed.
 */
export function ChangePhoneForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { user, requestPhoneChangeCode, confirmPhoneChange } = useAuth();
  const [phoneInput, setPhoneInput] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendAt === null || resendAt <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, now]);
  const { minutesLeft, expired: codeExpired } = useCodeExpiry(
    codeExpiresAt,
    now,
    setNow,
  );

  const phone = normalizePhone(phoneInput);
  const secondsLeft =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const canSend = phone !== null && !submitting;
  const canConfirm =
    CODE_PATTERN.test(code) &&
    !submitting &&
    !codeExpired &&
    code !== lastSubmitted;

  async function sendCode(target: string | null = phone) {
    if (!target) return setError(t("login.invalidPhone"));
    if (target === user?.phone) {
      return setError(t("account.phone.errors.sameNumber"));
    }
    setSubmitting(true);
    setError(null);
    try {
      const expiresIn = await requestPhoneChangeCode(target);
      const sentAt = Date.now();
      setCodeExpiresAt(sentAt + expiresIn * 1000);
      setSentTo(target);
      setCode("");
      setLastSubmitted(null);
      setResendAt(sentAt + RESEND_SECONDS * 1000);
      setNow(sentAt);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm(explicitCode?: string) {
    const submitted = explicitCode ?? code;
    // Each wrong code spends one of five attempts: never send the same one twice,
    // nor one that has expired and can only be refused.
    if (submitting || !sentTo || codeExpired || !CODE_PATTERN.test(submitted))
      return;
    if (submitted === lastSubmitted) return;
    setLastSubmitted(submitted);
    setSubmitting(true);
    setError(null);
    try {
      await confirmPhoneChange(sentTo, submitted);
      showToast(t("account.phone.changed"), "success");
      onDone();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo === null) {
    return (
      <View testID="change-phone-step-number">
        <Text className="mb-5 font-sans text-[14px] leading-5 text-muted">
          {t("account.phone.intro", { phone: user?.phone ?? "—" })}
        </Text>
        <Eyebrow className="mb-2">{t("account.phone.newNumber")}</Eyebrow>
        <FrenchPhoneField
          testID="change-phone-input"
          autoFocus
          value={phoneInput}
          onChangeText={setPhoneInput}
          onSubmitEditing={() => canSend && void sendCode()}
        />
        <Text className="mb-[18px] font-sans text-[12.5px] leading-[18px] text-muted">
          {t("login.phoneHint")}
        </Text>
        <ErrorLine error={error} />
        <Button
          testID="change-phone-send"
          label={t("login.sendCode")}
          loading={submitting}
          disabled={!canSend}
          onPress={() => void sendCode()}
          className="h-[52px]"
        />
      </View>
    );
  }

  return (
    <View testID="change-phone-step-code">
      <Text className="mb-5 font-sans text-[14px] leading-5 text-muted">
        {t("account.phone.codeSentTo", { phone: sentTo })}
      </Text>
      <Eyebrow className="mb-2">{t("login.code")}</Eyebrow>
      <OtpCodeBoxes
        testID="change-phone-code"
        value={code}
        onChange={setCode}
        onComplete={(completed) => void confirm(completed)}
        invalid={error !== null}
        disabled={submitting}
        positionLabel={(position) =>
          t("login.codeDigit", { position, total: CODE_LENGTH })
        }
      />
      <View className="mb-[18px] mt-3 flex-row items-center justify-between">
        <Pressable
          testID="change-phone-resend"
          accessibilityRole="button"
          disabled={secondsLeft > 0 || submitting}
          onPress={() => void sendCode(sentTo)}
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
        <Text
          testID="change-phone-code-expiry"
          className={`font-sans text-[12.5px] ${codeExpired ? "text-negative" : "text-muted"}`}
        >
          {codeExpired
            ? t("login.codeExpired")
            : t("login.codeExpires", { count: minutesLeft })}
        </Text>
      </View>
      <ErrorLine error={error} />
      <Button
        testID="change-phone-confirm"
        label={t("account.phone.confirm")}
        loading={submitting}
        disabled={!canConfirm}
        onPress={() => void confirm()}
        className="h-[52px]"
      />
      <Pressable
        testID="change-phone-other-number"
        accessibilityRole="button"
        onPress={() => {
          setSentTo(null);
          setCode("");
          setLastSubmitted(null);
          setError(null);
        }}
        className="mt-4 items-center"
        hitSlop={8}
      >
        <Text className="font-sans text-[13px] text-ink underline">
          {t("account.phone.otherNumber")}
        </Text>
      </Pressable>
    </View>
  );
}

/** The refusal itself, without the sign-in screen's "Sign-in failed:" frame. */
function ErrorLine({ error }: { error: string | null }) {
  const tokens = useTokens();
  if (!error) return null;
  return (
    <View className="mb-4 flex-row items-start gap-1.5">
      <Icon
        name="alert-circle"
        size={15}
        color={tokens.negative}
        style={{ marginTop: 2 }}
      />
      <Text
        testID="change-phone-error"
        className="flex-1 font-sans text-[13.5px] text-negative"
      >
        {error}
      </Text>
    </View>
  );
}
