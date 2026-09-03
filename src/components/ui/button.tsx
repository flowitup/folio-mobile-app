import { ActivityIndicator, Pressable, Text } from "react-native";
import type { PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "sm";

type Props = Omit<PressableProps, "children"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const CONTAINER: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "border border-border bg-white",
  danger: "bg-danger",
  ghost: "bg-transparent",
};

const LABEL: Record<Variant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-primary",
  danger: "text-primary-foreground",
  ghost: "text-primary",
};

const SIZE: Record<Size, string> = { md: "py-3 px-4", sm: "py-2 px-3" };

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  ...rest
}: Props & { className?: string }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive) }}
      disabled={inactive}
      className={`flex-row items-center justify-center rounded-lg ${SIZE[size]} ${CONTAINER[variant]} ${inactive ? "opacity-50" : ""} ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "secondary" || variant === "ghost" ? "#171717" : "#fff"
          }
        />
      ) : (
        <Text className={`text-base font-semibold ${LABEL[variant]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
