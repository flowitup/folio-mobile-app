import { ActivityIndicator, Pressable, Text } from "react-native";
import type { PressableProps } from "react-native";

import { useTokens } from "@/theme/tokens";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "sm";

type Props = Omit<PressableProps, "children"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

// 2a buttons: ink fill r10 (primary), 1px line-2 ghost r12 (secondary), negative outline (danger).
const CONTAINER: Record<Variant, string> = {
  primary: "rounded-[10px] bg-ink",
  secondary: "rounded-xl border border-line-2 bg-transparent",
  danger: "rounded-[10px] border border-negative bg-transparent",
  ghost: "rounded-[10px] bg-transparent",
};

const LABEL: Record<Variant, string> = {
  primary: "font-sans-semibold text-on-ink",
  secondary: "font-sans-medium text-ink",
  danger: "font-sans-semibold text-negative",
  ghost: "font-sans-medium text-ink",
};

// Disabled: muted fill / line and a muted label — `opacity` alone was invisible on the
// ink and negative variants, which made a blocked action look tappable.
const CONTAINER_DISABLED: Record<Variant, string> = {
  primary: "rounded-[10px] bg-line-2",
  secondary: "rounded-xl border border-line bg-transparent",
  danger: "rounded-[10px] border border-line bg-transparent",
  ghost: "rounded-[10px] bg-transparent",
};

const SIZE: Record<Size, string> = { md: "h-[50px] px-4", sm: "h-10 px-3" };
const LABEL_SIZE: Record<Size, string> = { md: "text-base", sm: "text-[13px]" };

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  ...rest
}: Props & { className?: string }) {
  const tokens = useTokens();
  const inactive = disabled || loading;
  const muted = Boolean(disabled) && !loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive) }}
      disabled={inactive}
      className={`flex-row items-center justify-center ${SIZE[size]} ${muted ? CONTAINER_DISABLED[variant] : CONTAINER[variant]} ${loading ? "opacity-50" : inactive ? "" : "active:opacity-70"} ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? tokens.onInk : tokens.ink}
        />
      ) : (
        <Text
          className={`${LABEL_SIZE[size]} ${muted ? "font-sans-medium text-muted" : LABEL[variant]}`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
