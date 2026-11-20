import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type NavigationAction = Parameters<
  Parameters<typeof usePreventRemove>[1]
>[0]["data"]["action"];

/**
 * Asks before an expense being typed is thrown away (P-12): back button, back swipe, Android
 * back, or a link out of the screen. `allowLeave()` lets the screen's own navigation through,
 * e.g. right after a successful save. The dialog has to be rendered by the screen.
 */
export function useDiscardGuard(dirty: boolean) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const leaving = useRef(false);
  const [pending, setPending] = useState<NavigationAction | null>(null);

  usePreventRemove(dirty, ({ data }) => {
    // Re-dispatching the same action skips this screen's guard (react-navigation marks it).
    if (leaving.current) navigation.dispatch(data.action);
    else setPending(data.action);
  });

  const dialog = (
    <ConfirmDialog
      visible={pending !== null}
      title={t("invoices.form.discardTitle")}
      message={t("invoices.form.discardMessage")}
      confirmLabel={t("invoices.form.discard")}
      cancelLabel={t("invoices.form.stay")}
      destructive
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const action = pending;
        setPending(null);
        leaving.current = true;
        if (action) navigation.dispatch(action);
      }}
    />
  );

  return {
    dialog,
    allowLeave: () => {
      leaving.current = true;
    },
  };
}
