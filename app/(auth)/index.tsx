import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView } from "react-native";

import { loginModesFor, useAuthConfig } from "@/auth/auth-config";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { PhoneSignIn } from "@/components/auth/phone-sign-in";
import { Segmented } from "@/components/ui/chip";

type Mode = "phone" | "email";

/**
 * Đăng nhập Folio (design 2c / 2d): an ink board carrying the headline, with the
 * form on a paper sheet pinned to the bottom — the same ink-block / paper pairing
 * the app uses for Overview and Expenses. Phone (SMS code) is the app's sign-in;
 * email + password appears only when the backend's LOGIN_MODE activates it.
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const config = useAuthConfig();
  const modes = useMemo(
    () => loginModesFor(config.data?.login_mode),
    [config.data?.login_mode],
  );
  const [chosen, setChosen] = useState<Mode>("phone");
  const mode: Mode = modes.includes(chosen) ? chosen : modes[0];
  const signup = config.data?.signup === true;

  const modeSwitcher =
    modes.length > 1 ? (
      <Segmented<Mode>
        testID="login-mode"
        options={modes.map((value) => ({
          value,
          label: t(`login.mode.${value}`),
        }))}
        value={mode}
        onChange={setChosen}
      />
    ) : null;

  return (
    // Both platforms need the avoidance. Android used to rely on the window
    // resizing under the keyboard, but this app is edge-to-edge, where the
    // window keeps its full height and the keyboard simply draws over the paper
    // sheet — the six code boxes and the sign-in button included.
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-ink-block">
      {mode === "phone" ? (
        <PhoneSignIn signup={signup} modeSwitcher={modeSwitcher} />
      ) : (
        <EmailSignIn modeSwitcher={modeSwitcher} />
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * Ink board above, paper sheet below. `pill` is the top-left affordance, which
 * sits on a dark chip so it stays legible over the board.
 */
