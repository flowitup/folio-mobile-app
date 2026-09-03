import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { formatDate, parseIsoDate, toIsoDate } from "@/lib/format/date";

type Props = {
  label?: string;
  /** ISO date `YYYY-MM-DD` or null. */
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
  doneLabel?: string;
  testID?: string;
};

/** Date field. iOS opens an inline spinner in a modal, Android the native dialog. */
export function DatePicker({
  label,
  value,
  onChange,
  placeholder,
  clearable,
  doneLabel = "OK",
  testID,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(parseIsoDate(value) ?? new Date());

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && date) onChange(toIsoDate(date));
      return;
    }
    if (date) setDraft(date);
  }

  return (
    <View className="mb-4">
      {label ? (
        <Text className="mb-1 text-sm text-muted-foreground">{label}</Text>
      ) : null}
      <View className="flex-row items-center">
        <Pressable
          testID={testID}
          accessibilityRole="button"
          onPress={() => {
            setDraft(parseIsoDate(value) ?? new Date());
            setOpen(true);
          }}
          className="flex-1 rounded-lg border border-border px-4 py-3"
        >
          <Text
            className={
              value
                ? "text-base text-primary"
                : "text-base text-muted-foreground"
            }
          >
            {value ? formatDate(value) : (placeholder ?? "—")}
          </Text>
        </Pressable>
        {clearable && value ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            className="ml-2 px-2"
          >
            <Text className="text-muted-foreground">✕</Text>
          </Pressable>
        ) : null}
      </View>

      {open && Platform.OS === "android" ? (
        <DateTimePicker value={draft} mode="date" onChange={handleChange} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/40"
            onPress={() => setOpen(false)}
          >
            <Pressable
              className="rounded-t-xl bg-white p-4"
              onPress={() => undefined}
            >
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                onChange={handleChange}
              />
              <Button
                label={doneLabel}
                onPress={() => {
                  onChange(toIsoDate(draft));
                  setOpen(false);
                }}
                testID={testID ? `${testID}-done` : undefined}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
