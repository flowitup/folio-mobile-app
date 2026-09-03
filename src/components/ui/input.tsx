import { Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
};

/** Labeled text input with optional error line. Pass `multiline` for a textarea. */
export function Input({
  label,
  error,
  hint,
  className,
  multiline,
  ...rest
}: Props & { className?: string }) {
  return (
    <View className="mb-4">
      {label ? (
        <Text className="mb-1 text-sm text-muted-foreground">{label}</Text>
      ) : null}
      <TextInput
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor="#a3a3a3"
        className={`rounded-lg border px-4 py-3 text-base text-primary ${error ? "border-danger" : "border-border"} ${multiline ? "min-h-24" : ""} ${className ?? ""}`}
        {...rest}
      />
      {error ? (
        <Text className="mt-1 text-xs text-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}

export function Textarea(props: Props & { className?: string }) {
  return <Input multiline numberOfLines={4} {...props} />;
}
