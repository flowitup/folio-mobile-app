import { Text, TextInput, View } from "react-native";

import { FIELD } from "@/components/auth/login-frame";
import { useTokens } from "@/theme/tokens";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  testID?: string;
};

/**
 * The FR +33 chip and the number field. SMS codes only ever leave through a French gateway, so
 * the dial code is stated rather than chosen. Shared by sign-in and the verified phone change.
 */
export function FrenchPhoneField({
  value,
  onChangeText,
  onSubmitEditing,
  autoFocus,
  testID = "login-phone",
}: Props) {
  const tokens = useTokens();
  return (
    <View className="mb-2 flex-row gap-2">
      <View className="h-[52px] flex-row items-center gap-1.5 rounded-[10px] border border-line-2 bg-paper-2 px-3">
        <Text className="font-sans-semibold text-[15px] text-ink">FR</Text>
        <Text className="font-mono text-[14px] text-muted">+33</Text>
      </View>
      <View className={`${FIELD} flex-1`}>
        <TextInput
          testID={testID}
          className="flex-1 font-mono text-[18px] text-ink"
          autoComplete="tel"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          placeholder="6 12 34 56 78"
          placeholderTextColor={tokens.muted2}
          autoFocus={autoFocus}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
        />
      </View>
    </View>
  );
}
