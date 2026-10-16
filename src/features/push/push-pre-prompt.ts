import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";

import i18n from "@/i18n";

// When "Not now" was last chosen; the explanation comes back after SNOOZE_MS.
const SNOOZED_AT_KEY = "folio.push.prePromptSnoozedAt";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

let inFlight: Promise<boolean> | null = null;

/**
 * The app's own explanation before the OS notification permission dialog, so the system
 * prompt is never the first thing a cold start shows. Resolves true when the user wants
 * notifications (then the OS dialog may follow). Several callers at once share one dialog.
 */
export function confirmPushPrePrompt(
  now: () => number = Date.now,
): Promise<boolean> {
  inFlight ??= ask(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function ask(now: () => number): Promise<boolean> {
  const snoozedAt = Number(
    await SecureStore.getItemAsync(SNOOZED_AT_KEY).catch(() => null),
  );
  if (snoozedAt && now() - snoozedAt < SNOOZE_MS) return false;
  const snooze = () =>
    void SecureStore.setItemAsync(SNOOZED_AT_KEY, String(now())).catch(
      () => undefined,
    );
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      i18n.t("notifications.prePrompt.title"),
      i18n.t("notifications.prePrompt.body"),
      [
        {
          text: i18n.t("notifications.prePrompt.later"),
          style: "cancel",
          onPress: () => {
            snooze();
            resolve(false);
          },
        },
        {
          text: i18n.t("notifications.prePrompt.enable"),
          onPress: () => resolve(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          snooze();
          resolve(false);
        },
      },
    );
  });
}
