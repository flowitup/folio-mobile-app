import { useState } from "react";
import { Text, View } from "react-native";

import { fitFontSize } from "@/lib/dashboard/fit-figure";

type Props = {
  /** The figure, already formatted ("415,00 €"). */
  text: string;
  /** Font size when it fits. */
  size: number;
  minScale?: number;
  /** Font family, color and margins; the size comes from `size`. */
  className?: string;
  testID?: string;
};

/**
 * A money figure on one line that shrinks to its box (down to `minScale`) and wraps past that,
 * so it never ends in "…" — on native and on the web build alike.
 */
export function FitFigure({
  text,
  size,
  minScale = 0.7,
  className,
  testID,
}: Props) {
  const [width, setWidth] = useState(0);
  const fit = fitFontSize(text, width, size, minScale);
  return (
    <View
      testID={testID ? `${testID}-box` : undefined}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Text
        testID={testID}
        className={className}
        style={{
          fontSize: fit.fontSize,
          lineHeight: Math.round(fit.fontSize * 1.25),
        }}
        numberOfLines={fit.wrap ? 2 : 1}
        adjustsFontSizeToFit={!fit.wrap}
        minimumFontScale={minScale}
      >
        {text}
      </Text>
    </View>
  );
}
