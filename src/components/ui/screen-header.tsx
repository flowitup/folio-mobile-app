import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  title: string;
  back?: boolean;
  /** Overrides the default history pop (e.g. leave a nested stack entirely). */
  onBack?: () => void;
  right?: ReactNode;
};

// Shared top bar: safe-area aware, optional back chevron, optional right-side action.
export function ScreenHeader({ title, back = false, onBack, right }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center border-b border-border bg-white px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      {back ? (
        <Pressable
          testID="header-back"
          onPress={
            onBack ??
            (() =>
              router.canGoBack()
                ? router.back()
                : router.navigate("/(app)/(tabs)/projects"))
          }
          hitSlop={12}
          className="mr-3"
        >
          <Text className="text-2xl text-primary">‹</Text>
        </Pressable>
      ) : null}
      <Text className="flex-1 text-xl font-bold text-primary" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
