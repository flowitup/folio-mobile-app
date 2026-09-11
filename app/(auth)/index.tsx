import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView } from "react-native";

import { useAuthConfig } from "@/auth/auth-config";
import { PhoneSignIn } from "@/components/auth/phone-sign-in";

/**
 * Đăng nhập Folio (design 2c / 2d): an ink board carrying the headline, with the
 * form on a paper sheet pinned to the bottom — the same ink-block / paper pairing
 * the app uses for Overview and Expenses. Phone (SMS code) is the only sign-in;
 * email and password were removed from the product.
 */
export default function LoginScreen() {
  useTranslation();
  const config = useAuthConfig();
  const signup = config.data?.signup === true;

  return (
    // Both platforms need the avoidance. Android used to rely on the window
    // resizing under the keyboard, but this app is edge-to-edge, where the
    // window keeps its full height and the keyboard simply draws over the paper
    // sheet — the six code boxes and the sign-in button included.
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-ink-block">
      <PhoneSignIn signup={signup} />
    </KeyboardAvoidingView>
  );
}
