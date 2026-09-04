import { Text, View } from "react-native";

import { initialOf, useTokens } from "@/theme/tokens";

type Props = {
  name: string | null | undefined;
  size?: number;
  /** Fill color; defaults to the paper-2 "account" avatar with a 1px line border. */
  color?: string;
  /** Square tile with the Fraunces initial (project switcher) instead of a round Inter avatar. */
  square?: boolean;
  testID?: string;
};

/** Initials avatar: round colored circle for people, ink square with a serif initial for projects. */
export function Avatar({
  name,
  size = 36,
  color,
  square = false,
  testID,
}: Props) {
  const tokens = useTokens();
  const fill = color ?? (square ? tokens.ink : tokens.paper2);
  const textColor = color ? "#ffffff" : square ? tokens.onInk : tokens.ink;
  return (
    <View
      testID={testID}
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: square ? Math.round(size / 4) : size / 2,
        backgroundColor: fill,
        borderWidth: color || square ? 0 : 1,
        borderColor: tokens.line,
      }}
    >
      <Text
        className={square ? "font-serif" : "font-sans-semibold"}
        style={{
          color: textColor,
          fontSize: square ? Math.round(size * 0.52) : Math.round(size * 0.38),
        }}
      >
        {initialOf(name)}
      </Text>
    </View>
  );
}
