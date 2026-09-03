import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { Button } from "@/components/ui/button";

// Small presentational primitives grouped in one file: Card, Badge, ListRow, Checkbox, EmptyState, ErrorState.

export function Card({
  children,
  className,
  style,
}: PropsWithChildren<{ className?: string; style?: StyleProp<ViewStyle> }>) {
  return (
    <View
      className={`rounded-lg border border-border bg-white p-4 ${className ?? ""}`}
      style={style}
    >
      {children}
    </View>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "danger";
const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-muted text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  return (
    <View
      className={`self-start rounded-full px-2 py-0.5 ${BADGE_TONE[tone].split(" ")[0]}`}
    >
      <Text className={`text-xs font-medium ${BADGE_TONE[tone].split(" ")[1]}`}>
        {label}
      </Text>
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
};

/** A tappable row: the phone-side replacement for a web table row. */
export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  testID,
}: ListRowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      className="mb-2 flex-row items-center rounded-lg border border-border bg-white px-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-base font-medium text-primary" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

type CheckboxProps = {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID?: string;
};

export function Checkbox({ label, value, onChange, testID }: CheckboxProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      className="mb-3 flex-row items-center"
    >
      <View
        className={`mr-3 h-5 w-5 items-center justify-center rounded border ${value ? "border-primary bg-primary" : "border-border bg-white"}`}
      >
        {value ? (
          <Text className="text-xs text-primary-foreground">✓</Text>
        ) : null}
      </View>
      <Text className="text-base text-primary">{label}</Text>
    </Pressable>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center px-6 py-12" testID="empty-state">
      <Text className="mb-4 text-center text-muted-foreground">{message}</Text>
      {action}
    </View>
  );
}

export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <View className="items-center px-6 py-12" testID="error-state">
      <Text className="mb-4 text-center text-danger">{message}</Text>
      <Button
        label={retryLabel}
        variant="secondary"
        size="sm"
        onPress={onRetry}
      />
    </View>
  );
}
