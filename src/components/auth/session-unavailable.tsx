import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { waitLabel } from "@/lib/auth/auth-error-message";

/**
 * Launch could not confirm the stored session: offline, a server error or a rate limit. The
 * session is kept — Retry checks again (so does coming back to the app), and signing out stays
 * available to someone who would rather start over than wait.
 */
export function SessionUnavailable() {
  const { t } = useTranslation();
  const { retrySession, signOut, unavailableRetryAfter } = useAuth();
  const [busy, setBusy] = useState<"retry" | "signOut" | null>(null);

  async function run(action: "retry" | "signOut") {
    setBusy(action);
    try {
      await (action === "retry" ? retrySession() : signOut());
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View
        className="flex-1 justify-center px-7 pb-10"
        testID="session-unavailable"
      >
        <Text className="mb-3 font-serif text-[26px] leading-[29px] text-ink">
          {t("login.unavailable.title")}
        </Text>
        <Text className="mb-8 font-sans text-base text-muted">
          {unavailableRetryAfter === null
            ? t("login.unavailable.body")
            : // A rate limit, not the connection: say so, and how long to wait.
              t("login.unavailable.busy", {
                wait:
                  waitLabel(unavailableRetryAfter, t) ??
                  t("common.errors.waitMinutes", { count: 1 }),
              })}
        </Text>
        <Button
          label={t("login.retry")}
          loading={busy === "retry"}
          disabled={busy !== null}
          onPress={() => void run("retry")}
          testID="session-unavailable-retry"
        />
        <Button
          label={t("home.signOut")}
          variant="ghost"
          className="mt-3"
          loading={busy === "signOut"}
          disabled={busy !== null}
          onPress={() => void run("signOut")}
          testID="session-unavailable-sign-out"
        />
      </View>
    </SafeAreaView>
  );
}
