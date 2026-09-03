import { Pressable, Text, View } from "react-native";

import { formatMonth, shiftMonth } from "@/lib/format/date";

type Props = {
  /** `YYYY-MM`. */
  value: string;
  onChange: (month: string) => void;
  testID?: string;
};

/** Previous / label / next month control used by labor and invoice month views. */
export function MonthPicker({ value, onChange, testID }: Props) {
  return (
    <View
      className="mb-3 flex-row items-center justify-between rounded-lg border border-border px-2 py-2"
      testID={testID}
    >
      <Pressable
        onPress={() => onChange(shiftMonth(value, -1))}
        hitSlop={8}
        className="px-3"
        testID={testID ? `${testID}-prev` : undefined}
      >
        <Text className="text-lg text-primary">‹</Text>
      </Pressable>
      <Text className="text-base font-medium capitalize text-primary">
        {formatMonth(value)}
      </Text>
      <Pressable
        onPress={() => onChange(shiftMonth(value, 1))}
        hitSlop={8}
        className="px-3"
        testID={testID ? `${testID}-next` : undefined}
      >
        <Text className="text-lg text-primary">›</Text>
      </Pressable>
    </View>
  );
}
