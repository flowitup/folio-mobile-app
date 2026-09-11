import { useEffect, useRef } from "react";
import { TextInput, View } from "react-native";
import type { TextInput as RNTextInput } from "react-native";

import { useTokens } from "@/theme/tokens";

export const CODE_LENGTH = 6;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Called on the edit that *completes* the row — drives auto sign-in. Retyping
   * over an already-full row does not re-fire it. */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Announced per box, e.g. "Digit 3 of 6". */
  positionLabel: (position: number) => string;
  testID?: string;
};

/**
 * The 6-digit SMS code as one box per digit (design 2d). The value stays a plain
 * compact string, so the row can never hold a gap: typing writes where you are
 * or appends, Backspace drops the last digit, and an iOS/Android autofill that
 * hands the whole code to the first box spreads across the row.
 */
export function OtpCodeBoxes({
  value,
  onChange,
  onComplete,
  invalid = false,
  disabled = false,
  positionLabel,
  testID = "login-code",
}: Props) {
  const tokens = useTokens();
  const boxes = useRef<(RNTextInput | null)[]>([]);
  const digits = value.padEnd(CODE_LENGTH, " ").slice(0, CODE_LENGTH).split("");

  // Someone typing quickly can land two keystrokes in one React batch, and the
  // second would then read `value` from the render before the first — losing a
  // digit. This ref is the authoritative code between renders.
  const typed = useRef(value);
  useEffect(() => {
    typed.current = value;
  }, [value]);

  const focusBox = (index: number) => {
    boxes.current[Math.min(Math.max(index, 0), CODE_LENGTH - 1)]?.focus();
  };

  const writeAt = (start: number, text: string) => {
    const incoming = text.replace(/\D/g, "");
    if (!incoming) return;
    const chars = typed.current.split("");
    let cursor = Math.min(start, chars.length);
    for (const char of incoming) {
      if (cursor >= CODE_LENGTH) break;
      chars[cursor] = char;
      cursor += 1;
    }
    const next = chars.join("").slice(0, CODE_LENGTH);
    // A rejected code keeps its digits, so the row is still full while the user
    // retypes over it. Only the edit that *fills* the row may sign in, or every
    // keystroke would spend one of the backend's five attempts.
    const wasComplete = typed.current.length === CODE_LENGTH;
    typed.current = next;
    onChange(next);
    focusBox(cursor);
    if (!wasComplete && next.length === CODE_LENGTH) onComplete?.(next);
  };

  const handleBackspace = (index: number) => {
    // Typing always advances, so the last digit is the one the user means to
    // take back; dropping it keeps the row gap-free and steps focus back.
    if (!typed.current) return;
    const next = typed.current.slice(0, -1);
    typed.current = next;
    onChange(next);
    focusBox(Math.min(next.length, index));
  };

  return (
    <View className="flex-row gap-2" testID={testID}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          testID={`${testID}-${index}`}
          accessibilityLabel={positionLabel(index + 1)}
          className="h-[58px] flex-1 rounded-[10px] bg-card text-center font-mono text-[25px] text-ink"
          style={{
            borderWidth: invalid ? 1.5 : 1,
            borderColor: invalid ? tokens.negative : tokens.line2,
          }}
          editable={!disabled}
          keyboardType="number-pad"
          // Only the first box claims the OTP hint: a platform autofill writes
          // the whole code there, and writeAt spreads it across the row.
          autoComplete={index === 0 ? "sms-otp" : "off"}
          textContentType={index === 0 ? "oneTimeCode" : "none"}
          maxLength={CODE_LENGTH}
          selectTextOnFocus
          value={digit === " " ? "" : digit}
          onChangeText={(text) => writeAt(index, text)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Backspace") handleBackspace(index);
          }}
          autoFocus={index === 0}
        />
      ))}
    </View>
  );
}
