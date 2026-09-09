import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { formatMonth, localeTag, shiftMonth } from "@/lib/format/date";
import { INK_BLOCK, useTokens } from "@/theme/tokens";

type Props = {
  /** `YYYY-MM`. */
  value: string;
  onChange: (month: string) => void;
  testID?: string;
  /** Short "Thg 9" label inside a pill (screen headers) instead of the full month name. */
  compact?: boolean;
  /** `ink`: outlined pill on the 1b ink block (ink-block line, on-ink label). */
  tone?: "paper" | "ink";
  /** Accessibility labels of the arrows. */
  prevLabel?: string;
  nextLabel?: string;
};

/** Month stepper pill (card bg, 1px line, 32px arrows) used by labor and invoice month views. */
export function MonthPicker({
  value,
  onChange,
  testID,
  compact = false,
  tone = "paper",
  prevLabel,
  nextLabel,
}: Props) {
  const tokens = useTokens();
  const ink = tone === "ink";
  const arrow = ink ? INK_BLOCK.muted : tokens.muted;
  return (
    <View
      className={`flex-row items-center self-start rounded-full border p-0.5 ${ink ? "border-ink-block-line bg-transparent" : "border-line bg-card"} ${compact ? "" : "mb-3 justify-between self-stretch"}`}
      testID={testID}
    >
      <Pressable
        onPress={() => onChange(shiftMonth(value, -1))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={prevLabel}
        className="h-8 w-8 items-center justify-center active:opacity-70"
        testID={testID ? `${testID}-prev` : undefined}
      >
        <Icon name="chevron-left" size={16} color={arrow} />
      </Pressable>
      <Text
        className={`px-1 font-sans-semibold text-[13px] capitalize ${ink ? "text-on-ink-block" : "text-ink"}`}
      >
        {compact ? shortMonthLabel(value) : formatMonth(value)}
      </Text>
      <Pressable
        onPress={() => onChange(shiftMonth(value, 1))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        className="h-8 w-8 items-center justify-center active:opacity-70"
        testID={testID ? `${testID}-next` : undefined}
      >
        <Icon name="chevron-right" size={16} color={arrow} />
      </Pressable>
    </View>
  );
}

/** `YYYY-MM` → short month in the active locale (`Thg 9`, `sept.`, `Sep`). */
export function shortMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag(), { month: "short" }).format(
    new Date(y, m - 1, 1),
  );
}
