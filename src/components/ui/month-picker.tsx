import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { formatMonth, shiftMonth } from "@/lib/format/date";
import { useTokens } from "@/theme/tokens";

type Props = {
  /** `YYYY-MM`. */
  value: string;
  onChange: (month: string) => void;
  testID?: string;
  /** Short "Thg 9" label inside a pill (screen headers) instead of the full month name. */
  compact?: boolean;
};

/** Month stepper pill (card bg, 1px line, 32px arrows) used by labor and invoice month views. */
export function MonthPicker({
  value,
  onChange,
  testID,
  compact = false,
}: Props) {
  const tokens = useTokens();
  return (
    <View
      className={`flex-row items-center self-start rounded-full border border-line bg-card p-0.5 ${compact ? "" : "mb-3 justify-between self-stretch"}`}
      testID={testID}
    >
      <Pressable
        onPress={() => onChange(shiftMonth(value, -1))}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center active:opacity-70"
        testID={testID ? `${testID}-prev` : undefined}
      >
        <Icon name="chevron-left" size={16} color={tokens.muted} />
      </Pressable>
      <Text className="px-1 font-sans-semibold text-[13px] capitalize text-ink">
        {compact ? shortMonthLabel(value) : formatMonth(value)}
      </Text>
      <Pressable
        onPress={() => onChange(shiftMonth(value, 1))}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center active:opacity-70"
        testID={testID ? `${testID}-next` : undefined}
      >
        <Icon name="chevron-right" size={16} color={tokens.muted} />
      </Pressable>
    </View>
  );
}

/** `YYYY-MM` → short month in the active locale (`Thg 9`, `sept.`, `Sep`). */
export function shortMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
  });
}
