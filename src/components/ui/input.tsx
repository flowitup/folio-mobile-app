import { Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

import { Eyebrow } from "@/components/ui/typography";
import { useTokens } from "@/theme/tokens";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
};

/** 2a text field: eyebrow label, 48px card-colored input, 1px line-2 border, r10, 16px text. */
export function Input({
  label,
  error,
  hint,
  className,
  multiline,
  ...rest
}: Props & { className?: string }) {
  const tokens = useTokens();
  return (
    <View className="mb-4">
      {label ? <Eyebrow className="mb-1.5">{label}</Eyebrow> : null}
      <TextInput
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        placeholderTextColor={tokens.muted2}
        className={`rounded-[10px] border bg-card px-3.5 font-sans text-base text-ink ${error ? "border-negative" : "border-line-2"} ${multiline ? "min-h-24 py-3" : "h-12"} ${className ?? ""}`}
        {...rest}
      />
      {error ? (
        <Text className="mt-1 font-sans text-xs text-negative">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 font-sans text-xs text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}

export function Textarea(props: Props & { className?: string }) {
  return <Input multiline numberOfLines={4} {...props} />;
}

/**
 * Search / filter field laid out in a row or above a list: the same look as `Input` (app font,
 * theme placeholder colour, line-2 border, card background, 48px) without the label and the
 * bottom margin, so the caller places it with `className` (`flex-1`, `mb-3`…).
 */
export function SearchInput({
  className,
  ...rest
}: TextInputProps & { className?: string }) {
  const tokens = useTokens();
  return (
    <TextInput
      placeholderTextColor={tokens.muted2}
      className={`h-12 rounded-[10px] border border-line-2 bg-card px-3.5 font-sans text-base text-ink ${className ?? ""}`}
      {...rest}
    />
  );
}
