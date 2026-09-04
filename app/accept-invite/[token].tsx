import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  acceptInvite,
  verifyInvite,
} from "@/features/invitations/invitations-api";
import type {
  InviteErrorReason,
  VerifyInviteResponse,
} from "@/features/invitations/invitations-api";

type State =
  | { kind: "loading" }
  | { kind: "error"; reason: InviteErrorReason | "generic" }
  | { kind: "ready"; invite: VerifyInviteResponse };

const ERROR_KEY: Record<InviteErrorReason | "generic", string> = {
  expired: "expired",
  revoked: "revoked",
  accepted: "accepted",
  not_found: "notFound",
  generic: "generic",
};

/** Deep link `folio://accept-invite/<token>`: verify → name + password → create the account → sign in. */
export default function AcceptInviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status, user, signIn, signOut } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

  async function submit() {
    if (state.kind !== "ready" || !token) return;
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100)
      return setError(t("acceptInvite.nameLabel"));
    if (password.length < 8 || password.length > 128)
      return setError(t("acceptInvite.passwordHint"));
    if (password !== confirm)
      return setError(t("acceptInvite.passwordMismatch"));
    setError(null);
    setSubmitting(true);
    try {
      await acceptInvite({ token, name: trimmed, password });
      await signIn(state.invite.email, password);
      router.replace("/(app)/(tabs)/dashboard");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("acceptInvite.errors.generic"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-card">
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
            <Input
              testID="invite-name"
              label={t("acceptInvite.nameLabel")}
              value={name}
              onChangeText={setName}
            />
            <Input
              testID="invite-password"
              label={t("acceptInvite.passwordLabel")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              hint={t("acceptInvite.passwordHint")}
            />
            <Input
              testID="invite-confirm"
              label={t("acceptInvite.confirmLabel")}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              error={error}
            />
            <Button
              testID="invite-submit"
              label={t("acceptInvite.submit")}
              loading={submitting}
              onPress={() => void submit()}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
