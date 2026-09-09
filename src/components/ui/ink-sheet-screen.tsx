import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

import { splitMoney } from "@/lib/format/money";

type Props = PropsWithChildren<{
  /** Fixed row above the scroller (project switcher, back button…), rendered on ink. */
  header?: ReactNode;
  /** Scrolls with the content, still on ink: headline figure, gauge, quick actions. */
  hero?: ReactNode;
  /** Vertical gap between the sheet's children (design 1b: 18 on overview, 14 on expenses). */
  gap?: number;
  /** Extra bottom padding, e.g. room for a floating button. */
  bottomPadding?: number;
  testID?: string;
}>;

/**
 * 1b screen frame: an ink block (fixed header + scrolling hero) with a paper sheet sliding over
 * it — 24px rounded top corners, paper continuing to the bottom of the screen. The scroller is
 * paper (short content still ends on paper), the hero wrapper is ink with an ink slab above it
 * so iOS bounce stays ink, and the sheet wrapper is ink so the rounded corners cut into ink.
 */
export function InkSheetScreen({
  header,
  hero,
  gap = 18,
  bottomPadding = 24,
  children,
  testID,
}: Props) {
  return (
    <View className="flex-1 bg-paper" testID={testID}>
      <View className="bg-ink-block">{header}</View>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="bg-ink-block">
          <View
            pointerEvents="none"
            className="absolute -top-[600px] left-0 right-0 h-[600px] bg-ink-block"
          />
          {hero}
        </View>
        <View className="bg-ink-block">
          <View
            className="rounded-t-[24px] bg-paper px-4 pt-5"
            style={{ gap, paddingBottom: bottomPadding }}
          >
            {children}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Headline money figure of an ink hero: integer part in a large mono face, decimals + currency
 * half as big and muted (`97.640` `,00 €`).
 */
export function InkFigure({
  amount,
  size = 40,
  negative = false,
  testID,
}: {
  amount: number;
  size?: 36 | 40;
  negative?: boolean;
  testID?: string;
}) {
  const { main, rest } = splitMoney(amount);
  const lineHeight = size + 4;
  return (
    <Text
      testID={testID}
      className={`font-mono ${negative ? "text-negative" : "text-on-ink-block"}`}
      style={{ fontSize: size, lineHeight, letterSpacing: -size * 0.03 }}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {main}
      <Text
        className="font-mono text-ink-block-muted"
        style={{ fontSize: size / 2 }}
      >
        {rest}
      </Text>
    </Text>
  );
}
