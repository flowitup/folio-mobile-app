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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive) }}
      disabled={inactive}
      className={`flex-row items-center justify-center ${SIZE[size]} ${CONTAINER[variant]} ${inactive ? "opacity-50" : "active:opacity-70"} ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? tokens.onInk : tokens.ink}
        />
      ) : (
        <Text className={`${LABEL_SIZE[size]} ${LABEL[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
