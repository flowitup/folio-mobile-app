import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { Sheet } from "@/components/ui/sheet";

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
}: Props<T>) {
  const sheet = useRef<BottomSheetModal>(null);
  const selected = options.find((option) => option.value === value);

  return (
    <View className="mb-4">
      {label ? (
        <Text className="mb-1 text-sm text-muted-foreground">{label}</Text>
      ) : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={() => sheet.current?.present()}
        className={`flex-row items-center justify-between rounded-lg border px-4 py-3 ${error ? "border-danger" : "border-border"}`}
      >
        <Text
          className={
            selected
              ? "text-base text-primary"
              : "text-base text-muted-foreground"
          }
        >
          {selected?.label ?? placeholder ?? "—"}
        </Text>
        <Text className="text-muted-foreground">▾</Text>
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-danger">{error}</Text> : null}
      <Sheet ref={sheet} title={label}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-option-${option.value}` : undefined}
            onPress={() => {
              onChange(option.value);
              sheet.current?.dismiss();
            }}
            className={`border-b border-border px-4 py-3 ${option.value === value ? "bg-muted" : ""}`}
          >
            <Text className="text-base text-primary">{option.label}</Text>
            {option.description ? (
              <Text className="text-xs text-muted-foreground">
                {option.description}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
