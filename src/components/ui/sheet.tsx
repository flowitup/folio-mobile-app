import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import { Keyboard, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTokens } from "@/theme/tokens";

const DEFAULT_SNAP_POINTS = ["50%", "90%"];

type Props = PropsWithChildren<{
  title?: string;
  snapPoints?: (string | number)[];
}>;

/**
 * Height the keyboard hides at the bottom of a sheet, so its scroller can leave room and
 * the submit button stays reachable.
 *
 * Android only. The manifest already asks for `adjustResize`, but the app is edge-to-edge,
 * where the system stops resizing the window — so the sheet keeps its full height and the
 * keyboard simply covers the bottom of it, with nothing to scroll. On iOS gorhom's own
 * `keyboardBehavior: "interactive"` lifts the sheet, and adding padding there would scroll
 * past the content instead.
 */
function useKeyboardOverlap(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const shown = Keyboard.addListener("keyboardDidShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}

/** Bottom sheet modal wrapper (paper panel, r20, line-2 grabber). Open with `ref.current?.present()`. */
export const Sheet = forwardRef<BottomSheetModal, Props>(function Sheet(
  { title, snapPoints = DEFAULT_SNAP_POINTS, children },
  ref,
) {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const keyboard = useKeyboardOverlap();
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
        testID="sheet-scroll"
        // Without this a tap while the keyboard is up is spent dismissing it, so the
        // submit button needs two presses.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 + keyboard }}
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
