import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { Eyebrow } from "@/components/ui/typography";
import { useTokens } from "@/theme/tokens";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type Props<T extends string> = {
  label?: string;
  placeholder?: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  error?: string | null;
  testID?: string;
  /** 38px field with 13px text (filters), instead of the 48px form field. */
  compact?: boolean;
};

/** Single-choice picker: a field that opens the options in a bottom sheet. */
export function Select<T extends string>({
  label,
  placeholder,
  value,
  options,
  onChange,
  error,
  testID,
  compact = false,
}: Props<T>) {
  const tokens = useTokens();
  const sheet = useRef<BottomSheetModal>(null);
  const selected = options.find((option) => option.value === value);

  return (
    <View className={compact ? "" : "mb-4"}>
      {label ? <Eyebrow className="mb-1.5">{label}</Eyebrow> : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={() => sheet.current?.present()}
        className={`flex-row items-center justify-between border bg-card ${compact ? "h-[38px] rounded-[9px] px-3" : "h-12 rounded-[10px] px-3.5"} ${error ? "border-negative" : "border-line-2"}`}
      >
        <Text
          numberOfLines={1}
          className={`mr-2 flex-1 font-sans ${compact ? "text-[13px]" : "text-base"} ${selected ? "text-ink" : "text-muted"}`}
        >
          {selected?.label ?? placeholder ?? "—"}
        </Text>
        <Icon name="chevron-down" size={14} color={tokens.muted} />
      </Pressable>
      {error ? (
        <Text className="mt-1 font-sans text-xs text-negative">{error}</Text>
      ) : null}
      <Sheet ref={sheet} title={label}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-option-${option.value}` : undefined}
            onPress={() => {
              onChange(option.value);
              sheet.current?.dismiss();
            }}
            className={`flex-row items-center border-b border-line px-4 py-3 ${option.value === value ? "bg-paper-2" : ""}`}
          >
            <View className="flex-1">
              <Text className="font-sans text-base text-ink">
                {option.label}
              </Text>
              {option.description ? (
                <Text className="font-sans text-xs text-muted">
                  {option.description}
                </Text>
              ) : null}
            </View>
            {option.value === value ? (
              <Icon name="check" size={16} color={tokens.ink} />
            ) : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
