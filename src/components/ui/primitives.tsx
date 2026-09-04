import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RowChevron } from "@/components/ui/typography";
import { cardShadow, useTokens } from "@/theme/tokens";

// Small presentational primitives grouped in one file: Card, Badge, ListRow, Checkbox, EmptyState, ErrorState.

/**
 * White (card) panel, 1px line, r12 by default. `radius` picks the 2a variants: 12 (tables),
 * 14 / 16 (expense and labor cards, which also carry the card shadow when `elevated`).
 */
export function Card({
  children,
  className,
  style,
  radius = 12,
  elevated = false,
  padded = true,
  testID,
}: PropsWithChildren<{
  className?: string;
  style?: StyleProp<ViewStyle>;
  radius?: 12 | 14 | 16;
  elevated?: boolean;
  padded?: boolean;
  testID?: string;
}>) {
  const tokens = useTokens();
  return (
    <View
      testID={testID}
      className={`border border-line bg-card ${padded ? "p-4" : ""} ${className ?? ""}`}
      style={[
        { borderRadius: radius },
        elevated ? cardShadow(tokens) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent";
const BADGE_TONE: Record<BadgeTone, { box: string; text: string }> = {
  neutral: { box: "bg-paper-2", text: "text-muted" },
  success: { box: "bg-positive-tint", text: "text-positive" },
  warning: { box: "bg-warning-tint", text: "text-warning" },
  danger: { box: "bg-negative-tint", text: "text-negative" },
  accent: { box: "bg-accent-tint", text: "text-accent-ink" },
};

/** Tinted pill chip (11.5px/500) — shift chips, payment states, statuses. */
export function Badge({
  label,
  tone = "neutral",
  testID,
}: {
  label: string;
  tone?: BadgeTone;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className={`self-start rounded-full px-2.5 py-1 ${BADGE_TONE[tone].box}`}
    >
      <Text
        className={`font-sans-medium text-[11.5px] ${BADGE_TONE[tone].text}`}
      >
        {label}
      </Text>
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string | null;
  /** Small muted text before the chevron (value column of the settings list). */
  value?: string | null;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  testID?: string;
  /** Rows inside a grouped Card: no own border/radius, 1px line below. */
  grouped?: boolean;
  chevron?: boolean;
};

/** A tappable row: the phone-side replacement for a web table row. */
export function ListRow({
  title,
  subtitle,
  value,
  right,
  left,
  onPress,
  testID,
  grouped = false,
  chevron = false,
}: ListRowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center gap-3 ${grouped ? "border-b border-line px-3.5 py-[13px]" : "mb-2 rounded-xl border border-line bg-card px-3.5 py-3"} ${onPress ? "active:opacity-70" : ""}`}
    >
      {left}
      <View className="flex-1">
        <Text
          className="font-sans-medium text-[14px] text-ink"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="mt-px font-sans text-[11.5px] text-muted"
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text className="font-sans text-[13px] text-muted">{value}</Text>
      ) : null}
      {right}
      {chevron ? <RowChevron /> : null}
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
  const tokens = useTokens();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      className="mb-3 flex-row items-center"
    >
      <View
        className={`mr-3 h-5 w-5 items-center justify-center rounded-[5px] border-[1.5px] ${value ? "border-ink bg-ink" : "border-line-2 bg-card"}`}
      >
        {value ? <Icon name="check" size={12} color={tokens.onInk} /> : null}
      </View>
      <Text className="font-sans text-base text-ink">{label}</Text>
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
      <Text className="mb-4 text-center font-sans text-muted">{message}</Text>
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
      <Text className="mb-4 text-center font-sans text-negative">
        {message}
      </Text>
      <Button
        label={retryLabel}
        variant="secondary"
        size="sm"
        onPress={onRetry}
      />
    </View>
  );
}
