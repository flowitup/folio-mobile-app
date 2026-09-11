import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  acceptInvite,
  requestInviteCode,
  verifyInvite,
  InviteActionError,
} from "@/features/invitations/invitations-api";
import type {
  InviteErrorReason,
  VerifyInviteResponse,
} from "@/features/invitations/invitations-api";
import { normalizePhone } from "@/lib/auth/phone-number";

type State =
  | { kind: "loading" }
  | { kind: "error"; reason: InviteErrorReason | "generic" }
  | { kind: "ready"; invite: VerifyInviteResponse };

/** Once the invitation itself checks out: collect name + phone, verify the SMS code, done. */
type Step = "details" | "code";

const ERROR_KEY: Record<InviteErrorReason | "generic", string> = {
  expired: "expired",
  revoked: "revoked",
  accepted: "accepted",
  not_found: "notFound",
  generic: "generic",
};

const RESEND_SECONDS = 60;

/**
 * A 410/404 mid-flow means the invitation itself became unusable (expired, revoked, already
 * accepted, or a garbage token) — the whole screen swaps to the same terminal error card the
 * initial `verifyInvite()` check uses. Everything else is a retryable mistake shown inline next
 * to the field that caused it, keeping the name/phone the invitee already typed.
 */
function screenErrorReason(
  error: InviteActionError,
): InviteErrorReason | "generic" | null {
  switch (error.reason) {
    case "expired":
    case "revoked":
    case "accepted":
    case "not_found":
      return error.reason;
    case "generic":
      return "generic";
    default:
      return null;
  }
}

function inlineErrorKey(error: InviteActionError): string {
  switch (error.reason) {
    case "invalid_phone":
      return "login.invalidPhone";
    case "phone_registered":
      return "login.errors.phoneTaken";
    case "invalid_code":
      return "login.errors.invalidCode";
    case "throttled":
      return "login.errors.throttled";
    case "sms_failed":
      return "login.errors.smsFailed";
    default:
      return "acceptInvite.errors.generic";
  }
}

/**
 * Deep link `folio://accept-invite/<token>`: verify → name + French phone → SMS code → signed in.
 * The invitee never chooses a password; acceptance only proves phone ownership, the same way
 * phone sign-up does. Acceptance returns the session tokens in its body, so the invitee lands
 * in the app directly rather than being sent back through sign-in for a second code.
 */
export default function AcceptInviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status, user, signOut, signInWithSession } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    verifyInvite(token)
      .then((result) => {
        if (cancelled) return;
        if ("error" in result)
          setState({ kind: "error", reason: result.error });
        else setState({ kind: "ready", invite: result });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error", reason: "generic" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Tick once a second while the resend timer runs (mirrors the sign-in and sign-up screens).
  useEffect(() => {
    if (resendAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const normalizedPhone = normalizePhone(phoneInput);
  const secondsLeft =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const canSend =
    name.trim().length > 0 && normalizedPhone !== null && !submitting;
  const canCreate = /^\d{6}$/.test(code) && !submitting;

  function fail(caught: unknown) {
    if (caught instanceof InviteActionError) {
      const reason = screenErrorReason(caught);
      if (reason) {
        setState({ kind: "error", reason });
        return;
      }
      setError(t(inlineErrorKey(caught)));
      return;
    }
    setError(
      caught instanceof Error
        ? caught.message
        : t("acceptInvite.errors.generic"),
    );
  }

  async function sendCode() {
    if (!token || !canSend || !normalizedPhone) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestInviteCode({ token, phone: normalizedPhone });
      setSentTo(normalizedPhone);
      setCode("");
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setNow(Date.now());
      setStep("code");
    } catch (caught) {
      fail(caught);
    } finally {
      setSubmitting(false);
    }
  }

  async function create() {
    if (!token || !sentTo || !canCreate) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await acceptInvite({
        token,
        name: name.trim(),
        phone: sentTo,
        code,
      });
      // Acceptance already signed them in — adopt the session, then navigate.
      // This screen sits outside the Stack.Protected guards so the invitee can
      // reach it signed out, which also means flipping to "signedIn" makes the
      // app navigable but does not navigate; without this replace the render
      // below falls into the "signed in as someone else" branch and offers to
      // sign out of the session just earned.
      await signInWithSession(session);
      router.replace("/(app)/(tabs)");
    } catch (caught) {
      fail(caught);
    } finally {
      setSubmitting(false);
    }
  }

  function changeNumber() {
    setStep("details");
    setSentTo(null);
    setCode("");
    setError(null);
    setResendAt(null);
  }

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader
        title={t("acceptInvite.title", {
          projectName: state.kind === "ready" ? state.invite.project_name : "…",
        })}
      />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {status === "signedIn" ? (
          <Card>
            <Text className="text-base font-semibold text-primary">
              {t("acceptInvite.loggedInOther.title")}
            </Text>
            <Text className="my-2 text-sm text-primary">
              {t("acceptInvite.loggedInOther.body", {
                currentEmail: user?.email ?? "",
              })}
            </Text>
            <Button
              testID="invite-sign-out"
              label={t("acceptInvite.loggedInOther.signOut")}
              variant="secondary"
              onPress={() => void signOut()}
            />
          </Card>
        ) : state.kind === "loading" ? (
          <ActivityIndicator className="mt-8" />
        ) : state.kind === "error" ? (
          <Card>
            <Text testID="invite-error" className="text-base text-danger">
              {t(`acceptInvite.errors.${ERROR_KEY[state.reason]}`)}
            </Text>
            <Button
              testID="invite-back"
              label={t("acceptInvite.backToLogin")}
              variant="secondary"
              className="mt-3"
              onPress={() => router.replace("/(auth)")}
            />
          </Card>
        ) : (
          <View>
            <Text className="mb-3 text-sm text-primary">
              {t("acceptInvite.intro", {
                inviter: state.invite.inviter_name,
                project: state.invite.project_name,
                role: state.invite.role_name,
              })}
            </Text>
            <Input
              label={t("acceptInvite.emailLabel")}
              value={state.invite.email}
              editable={false}
            />

            {step === "details" ? (
              <View>
                <Input
                  testID="invite-name"
                  label={t("acceptInvite.nameLabel")}
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  textContentType="name"
                  maxLength={100}
                />
                <Input
                  testID="invite-phone"
                  label={t("login.phone")}
                  hint={t("login.phoneHint")}
                  error={error}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  placeholder="06 12 34 56 78"
                  onSubmitEditing={() => void sendCode()}
                />
                <Button
                  testID="invite-send-code"
                  label={t("login.sendCode")}
                  loading={submitting}
                  disabled={!canSend}
                  onPress={() => void sendCode()}
                />
              </View>
            ) : (
              <View>
                <Text
                  testID="invite-code-sent"
                  className="mb-3 text-sm text-primary"
                >
                  {t("login.codeSentTo", { phone: sentTo })}
                </Text>
                <Input
                  testID="invite-code"
                  label={t("login.code")}
                  error={error}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  placeholder="••••••"
                  autoFocus
                  onSubmitEditing={() => void create()}
                />
                <Button
                  testID="invite-submit"
                  label={t("acceptInvite.submit")}
                  loading={submitting}
                  disabled={!canCreate}
                  onPress={() => void create()}
                />
                <View className="mt-4 flex-row items-center justify-between">
                  <Pressable
                    testID="invite-resend"
                    accessibilityRole="button"
                    disabled={secondsLeft > 0 || submitting}
                    onPress={() => void sendCode()}
                    hitSlop={8}
                  >
                    <Text
                      className={`text-[13px] ${secondsLeft > 0 ? "text-muted" : "text-primary"}`}
                    >
                      {secondsLeft > 0
                        ? t("login.resendIn", { seconds: secondsLeft })
                        : t("login.resend")}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID="invite-change-phone"
                    accessibilityRole="button"
                    onPress={changeNumber}
                    hitSlop={8}
                  >
                    <Text className="text-[13px] text-primary">
                      {t("login.changePhone")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
