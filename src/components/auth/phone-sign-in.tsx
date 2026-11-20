import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { FrenchPhoneField } from "@/components/auth/french-phone-field";
import {
  InkPill,
  LoginFrame,
  SignInErrorLine,
} from "@/components/auth/login-frame";
import { CODE_LENGTH, OtpCodeBoxes } from "@/components/auth/otp-code-boxes";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Eyebrow } from "@/components/ui/typography";
import { LegalLinks } from "@/components/legal-links";
import { AuthRequestError, isResendGap } from "@/lib/auth/auth-error-message";
import { formatFrenchPhone, normalizePhone } from "@/lib/auth/phone-number";
import { useCodeExpiry } from "@/lib/auth/use-code-expiry";
import { INK_BLOCK } from "@/theme/tokens";
import { LanguageChips } from "@/components/language-chips";

const RESEND_SECONDS = 60;
// The backend refuses a code after this many wrong tries, even the right one.
const MAX_CODE_ATTEMPTS = 5;

/** Step 1: phone → "Send code"; step 2: the 6-digit code with a 60 s resend timer. */
export function PhoneSignIn({ signup }: { signup: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { requestOtp, signInWithOtp } = useAuth();
  const [phoneInput, setPhoneInput] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  // The number the backend last texted, kept across "Đổi số": the code it sent is still valid
  // for its whole TTL, so coming back to that number must reopen the code step instead of
  // asking for another one the backend would refuse for a minute.
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  // The backend decides the code's lifetime (OTP_TTL_SECONDS) and reports it on
  // every request, so the sheet counts down what was actually sent rather than a
  // number that silently drifts from the server's — and says when it has expired.
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  // The code the backend has already rejected. Sending it again would spend
  // another of the five attempts for nothing, so the sheet waits for a change —
  // state, not a ref, because the sign-in button's own state depends on it.
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Not an error: why the code step opened without a new SMS.
  const [notice, setNotice] = useState<string | null>(null);
  // Wrong codes refused for the code now in use.
  const [failedAttempts, setFailedAttempts] = useState(0);
  // The backend refused the last code typed. It also refuses every code for a number that has no
  // account yet — the case of someone a company added by phone who never created one — so this
  // is where the screen points first-time users to sign-up (it says the same to everyone).
  const [codeRefused, setCodeRefused] = useState(false);
  const codeLocked = failedAttempts >= MAX_CODE_ATTEMPTS;

  // Tick once a second while the resend timer runs, and stop when it expires —
  // a live interval would re-render the six code inputs under the user's typing.
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
  // The backend throttles per number, so the countdown only gates asking again
  // for the SAME number: edit the number and "Send code" is live immediately.
  // A number that does not read as French keeps the button live: pressing it says why, where a
  // greyed-out button explained nothing.
  const canSend =
    phoneInput.trim().length > 0 &&
    !submitting &&
    (phone === null || secondsLeft === 0 || phone !== sentTo);
  // Said as soon as a full-length entry cannot be French, before any press.
  const showInvalidHint =
    phone === null && phoneInput.replace(/\D/g, "").length >= 10;
  // Changing the number back while that code is still in flight: nothing to ask for.
  const hasCodeInFlight =
    phone !== null && phone === codeSentTo && secondsLeft > 0;
  const canVerify =
    new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) &&
    !submitting &&
    !codeExpired &&
    !codeLocked &&
    code !== lastSubmitted;

  async function sendCode() {
    if (!phone) return setError(t("login.invalidPhone"));
    if (hasCodeInFlight) {
      // Reopen the code step with the code already texted; requesting a second one inside the
      // backend's per-number cooldown only answers 429 and strands the user for a minute.
      setError(null);
      setNotice(t("login.codeStillValid"));
      setSentTo(phone);
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    setCodeRefused(false);
    try {
      const expiresIn = await requestOtp(phone);
      const sentAt = Date.now();
      setCodeExpiresAt(sentAt + expiresIn * 1000);
      setSentTo(phone);
      setCodeSentTo(phone);
      // A new code invalidates whatever is still in the boxes.
      setCode("");
      setLastSubmitted(null);
      setFailedAttempts(0);
      setResendAt(sentAt + RESEND_SECONDS * 1000);
      setNow(sentAt);
    } catch (caught) {
      if (isResendGap(caught)) {
        // A code went to this number moments ago, and the app lost track of it (it was closed,
        // or reloaded): that code is still good, so open the code step for it instead of
        // calling the refusal a failed sign-in.
        const at = Date.now();
        if (phone !== codeSentTo) {
          setCodeExpiresAt(null);
          setCode("");
          setLastSubmitted(null);
          setFailedAttempts(0);
        }
        setSentTo(phone);
        setCodeSentTo(phone);
        setNotice(t("login.codeStillValid"));
        setResendAt(at + (caught.retryAfter ?? RESEND_SECONDS) * 1000);
        setNow(at);
        return;
      }
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function openSignup(number: string | null) {
    router.push(
      number ? { pathname: "/signup", params: { phone: number } } : "/signup",
    );
  }

  async function verify(explicitCode?: string) {
    // Auto sign-in passes the code it just completed: reading it from state here
    // would still see the value from before that keystroke.
    const submitted = explicitCode ?? code;
    // The backend counts a wrong code against a 5-attempt limit, so never let an
    // auto sign-in and a button press of the same code both go out. An expired
    // code can only be refused, and would spend an attempt too.
    if (submitting || !sentTo || codeExpired || codeLocked) return;
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(submitted)) return;
    if (submitted === lastSubmitted) return;
    setLastSubmitted(submitted);
    setSubmitting(true);
    setError(null);
    setNotice(null);
    setCodeRefused(false);
    try {
      await signInWithOtp(sentTo, submitted);
    } catch (caught) {
      if (caught instanceof AuthRequestError && caught.status === 401) {
        // A wrong code: empty the boxes and put the caret back in the first one, so typing the
        // right code signs in again (the full, red row used to swallow taps until a resend).
        const failed = failedAttempts + 1;
        setFailedAttempts(failed);
        setCodeRefused(true);
        setCode("");
        setLastSubmitted(null);
        setError(
          failed >= MAX_CODE_ATTEMPTS
            ? t("login.errors.codeLocked")
            : (caught as Error).message,
        );
      } else {
        // Keep the digits: the user needs to see what was rejected.
        setError((caught as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function changeNumber() {
    setSentTo(null);
    setCode("");
    setLastSubmitted(null);
    setError(null);
    setNotice(null);
    setCodeRefused(false);
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
        <Eyebrow className="mb-2">{t("login.phone")}</Eyebrow>
        <FrenchPhoneField
          value={phoneInput}
          onChangeText={setPhoneInput}
          onSubmitEditing={() => canSend && void sendCode()}
        />
        {showInvalidHint ? (
          <Text
            testID="login-invalid-phone-hint"
            className="mb-[18px] font-sans text-[12.5px] leading-[18px] text-negative"
          >
            {t("login.invalidPhoneHint")}
          </Text>
        ) : (
          <Text className="mb-[18px] font-sans text-[12.5px] leading-[18px] text-muted">
            {t("login.phoneHint")}
          </Text>
        )}
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
            onPress={() => openSignup(phone)}
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
        <LanguageChips className="mt-4" />
        <LegalLinks className="mt-3" />
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
          values={{ phone: formatFrenchPhone(sentTo) }}
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
      {notice ? (
        <Text
          testID="login-code-notice"
          className="mb-2 font-sans text-[12.5px] text-muted"
        >
          {notice}
        </Text>
      ) : null}
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
          {/* Unknown for a code texted before the app lost track of it (D3). */}
          {codeExpiresAt !== null ? (
            <Text
              testID="login-code-expiry"
              className={`font-sans text-[12.5px] ${codeExpired ? "text-negative" : "text-muted"}`}
            >
              {codeExpired
                ? t("login.codeExpired")
                : t("login.codeExpires", { count: minutesLeft })}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="mb-[18px] mt-3">
          <SignInErrorLine error={error} />
          {signup && codeRefused ? (
            <FirstTimeSignupHint onPress={() => openSignup(sentTo)} />
          ) : null}
          {/* The retry stays off once the code has expired: say why. */}
          {codeExpired ? (
            <Text
              testID="login-code-expiry"
              className="mb-3 font-sans text-[12.5px] text-negative"
            >
              {t("login.codeExpired")}
            </Text>
          ) : null}
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
      {/* Said to everyone, account or not, so it reveals nothing — but someone who gets no SMS
          learns why, and where accounts come from. */}
      <Text
        testID="login-code-help"
        className="mt-3 text-center font-sans text-[12px] leading-[17px] text-muted"
      >
        {signup
          ? `${t("login.codeHelpNeverSignedIn")} ${t("login.codeHelp")}`
          : t("login.codeHelp")}
      </Text>
      {signup ? (
        <Pressable
          testID="login-code-signup"
          accessibilityRole="button"
          onPress={() => openSignup(sentTo)}
          className="mt-2 items-center"
          hitSlop={8}
        >
          <Text className="font-sans-semibold text-[13px] text-ink underline">
            {t("login.createAccount")}
          </Text>
        </Pressable>
      ) : null}
      <LegalLinks className="mt-3" />
    </LoginFrame>
  );
}

/**
 * Shown under a refused code (D1): a number a company added by phone still has no account, so its
 * codes are always refused until its owner signs up. Said to everyone, so it reveals nothing.
 */
function FirstTimeSignupHint({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View
      testID="login-first-time"
      className="mb-4 rounded-[12px] border border-line-2 bg-paper-2 p-3.5"
    >
      <Text className="mb-3 font-sans text-[13.5px] leading-[19px] text-ink">
        {t("login.firstTime.body")}
      </Text>
      <Button
        testID="login-first-time-signup"
        label={t("login.firstTime.action")}
        onPress={onPress}
      />
    </View>
  );
}
