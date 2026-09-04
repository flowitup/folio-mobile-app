import { Pressable, Text } from "react-native";
import type { PropsWithChildren } from "react";

import { Icon } from "@/components/ui/icon";
import { useTokens } from "@/theme/tokens";

/** 11px uppercase muted label with .1em tracking — section and field eyebrows. */
export function Eyebrow({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <Text
      className={`font-sans-medium text-[11px] uppercase tracking-[1.1px] text-muted ${className ?? ""}`}
    >
      {children}
    </Text>
  );
}

/** Fraunces screen title (26px, line-height 1.1). */
export function ScreenTitle({
  children,
  className,
  testID,
}: PropsWithChildren<{ className?: string; testID?: string }>) {
  return (
    <Text
      testID={testID}
      className={`font-serif text-[26px] leading-[29px] text-ink ${className ?? ""}`}
    >
      {children}
    </Text>
  );
}

/** 12px accent-ink "Label ›" link used at section headers. */
export function SectionLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} testID={testID}>
      <Text className="font-sans text-xs text-accent-ink">{label} ›</Text>
    </Pressable>
  );
}

/** Muted-2 chevron used at the right edge of list rows. */
export function RowChevron() {
  const tokens = useTokens();
  return <Icon name="chevron-right" size={16} color={tokens.muted2} />;
}
