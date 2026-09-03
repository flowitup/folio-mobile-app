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

const DEFAULT_SNAP_POINTS = ["50%", "90%"];

type Props = PropsWithChildren<{
  title?: string;
  snapPoints?: (string | number)[];
}>;

/** Bottom sheet modal wrapper. Open with `ref.current?.present()`, close with `dismiss()`. */
export const Sheet = forwardRef<BottomSheetModal, Props>(function Sheet(
  { title, snapPoints = DEFAULT_SNAP_POINTS, children },
  ref,
) {
  const insets = useSafeAreaInsets();
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={false}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {title ? (
          <View className="border-b border-border px-4 pb-3">
            <Text className="text-lg font-semibold text-primary">{title}</Text>
          </View>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
