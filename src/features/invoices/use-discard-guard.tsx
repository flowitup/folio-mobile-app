import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler } from "react-native";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { setLeaveGuard } from "@/lib/navigation/leave-guard";

type NavigationAction = Parameters<
  Parameters<typeof usePreventRemove>[1]
>[0]["data"]["action"];

/** What happens once the user agrees to throw the typed expense away. */
type Pending = { action: NavigationAction } | { proceed: () => void };

type NavLike = {
  getParent?: () => NavLike | undefined;
  getState?: () =>
    { type?: string; routes: { key: string; name: string }[] } | undefined;
  addListener?: (
    event: "tabPress",
    cb: (e: { target?: string; preventDefault: () => void }) => void,
  ) => () => void;
  navigate?: (name: string) => void;
};

/** The bottom-tab navigator this screen lives in, if any. */
function findTabNavigator(navigation: NavLike): NavLike | undefined {
  let nav: NavLike | undefined = navigation.getParent?.();
  while (nav) {
    if (nav.getState?.()?.type === "tab") return nav;
    nav = nav.getParent?.();
  }
  return undefined;
}

/**
 * Asks before an expense being typed is thrown away (P-12): the header back arrow, back swipe,
 * Android back, another tab, or a link out of the screen. The new-expense screen can be the first
 * screen of its stack, so going back moves to another tab instead of removing the screen; the
 * header arrow, Android back and tab presses are therefore guarded directly, on top of
 * `usePreventRemove`. `allowLeave()` lets the screen's own navigation through, e.g. right after a
 * successful save. The dialog has to be rendered by the screen.
 */
export function useDiscardGuard(dirty: boolean) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const leaving = useRef(false);
  const [pending, setPending] = useState<Pending | null>(null);

  usePreventRemove(dirty, ({ data }) => {
    // Re-dispatching the same action skips this screen's guard (react-navigation marks it).
    if (leaving.current) navigation.dispatch(data.action);
    else setPending({ action: data.action });
  });

  // Header back arrow (shared ScreenHeader) and Android hardware back.
  useEffect(() => {
    if (!dirty) return;
    const offGuard = setLeaveGuard((proceed) => {
      if (leaving.current) return false;
      setPending({ proceed });
      return true;
    });
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (leaving.current) return false;
      setPending({ proceed: () => navigation.goBack() });
      return true;
    });
    return () => {
      offGuard();
      sub.remove();
    };
  }, [dirty, navigation]);

  // Another tab in the bottom bar.
  useEffect(() => {
    if (!dirty) return;
    const tabs = findTabNavigator(navigation as unknown as NavLike);
    if (!tabs?.addListener) return;
    return tabs.addListener("tabPress", (e) => {
      if (leaving.current) return;
      const route = tabs.getState?.()?.routes.find((r) => r.key === e.target);
      if (!route) return;
      e.preventDefault();
      setPending({ proceed: () => tabs.navigate?.(route.name) });
    });
  }, [dirty, navigation]);

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
        const next = pending;
        setPending(null);
        leaving.current = true;
        if (!next) return;
        if ("action" in next) navigation.dispatch(next.action);
        else next.proceed();
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
