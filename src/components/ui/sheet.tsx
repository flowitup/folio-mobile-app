import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { forwardRef, useCallback } from "react";
import type { PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTokens } from "@/theme/tokens";

const DEFAULT_SNAP_POINTS = ["50%", "90%"];

type Props = PropsWithChildren<{
  title?: string;
  snapPoints?: (string | number)[];
}>;

/** Bottom sheet modal wrapper (paper panel, r20, line-2 grabber). Open with `ref.current?.present()`. */
export const Sheet = forwardRef<BottomSheetModal, Props>(function Sheet(
  { title, snapPoints = DEFAULT_SNAP_POINTS, children },
  ref,
) {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        style={[props.style, { backgroundColor: tokens.scrim }]}
        opacity={1}
      />
    ),
    [tokens.scrim],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={false}
      backgroundStyle={{ backgroundColor: tokens.paper, borderRadius: 20 }}
      handleIndicatorStyle={{
        backgroundColor: tokens.line2,
        width: 36,
        height: 4,
      }}
      // A sheet opened from inside another sheet (Select in a form) stacks instead of replacing it.
      stackBehavior="push"
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {title ? (
          <View className="border-b border-line px-4 pb-3">
            <Text className="font-sans-semibold text-lg text-ink">{title}</Text>
          </View>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
