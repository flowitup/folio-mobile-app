import { Pressable, ScrollView, Text, View } from "react-native";

/**
 * 2a filter chips: 34px pills, 1px line-2 when idle, ink fill + on-ink text when active.
 * Rendered in a horizontal scroller that bleeds 16px past the screen padding.
 */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  testID,
  trailing,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4 max-h-[34px]"
      contentContainerClassName="flex-row items-center gap-1.5 px-4"
      testID={testID}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            onPress={() => onChange(option.value)}
            accessibilityState={{ selected: active }}
            className={`h-[34px] justify-center rounded-full border px-[13px] active:opacity-70 ${active ? "border-ink bg-ink" : "border-line-2 bg-transparent"}`}
          >
            <Text
              className={`font-sans-medium text-[13px] ${active ? "text-on-ink" : "text-ink"}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      {trailing ? <View>{trailing}</View> : null}
    </ScrollView>
  );
}

/** 2a segmented control: paper-2 track r12 p3, card thumb r10 with a 1px shadow. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
  /** md = 36px items / r12 track (labor); sm = 32px items / r9 track (billing). */
  size?: "md" | "sm";
}) {
  const track = size === "md" ? "rounded-xl" : "rounded-[9px]";
  const thumb = size === "md" ? "h-9 rounded-[10px]" : "h-8 rounded-[7px]";
  return (
    <View className={`flex-row bg-paper-2 p-[3px] ${track}`} testID={testID}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            onPress={() => onChange(option.value)}
            accessibilityState={{ selected: active }}
            className={`flex-1 items-center justify-center ${thumb} ${active ? "bg-card" : ""}`}
            style={
              active ? { boxShadow: "0 1px 2px rgba(26,26,26,0.08)" } : null
            }
          >
            <Text
              className={`font-sans-medium text-[13px] ${active ? "text-ink" : "text-muted"}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
