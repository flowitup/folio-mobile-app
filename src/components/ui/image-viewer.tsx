import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthedImage } from "@/components/ui/authed-image";
import { ToastViewport } from "@/components/ui/toast";

/**
 * Pictures the in-app viewer can draw: what React Native's image loader decodes on both
 * platforms. HEIC and anything else still go to the OS share sheet.
 */
const VIEWABLE_IMAGE = /^image\/(jpe?g|png|webp|gif)$/i;
const VIEWABLE_EXTENSION = /\.(jpe?g|png|webp|gif)$/i;

/** True when the file is a picture the in-app viewer shows (by MIME type, else by name). */
export function isViewableImage(
  mimeType: string | null | undefined,
  filename: string,
): boolean {
  return mimeType && mimeType !== "application/octet-stream"
    ? VIEWABLE_IMAGE.test(mimeType.trim())
    : VIEWABLE_EXTENSION.test(filename.trim());
}

type Props = {
  /** API path of the picture (authenticated download); null keeps the viewer closed. */
  path: string | null;
  filename: string;
  onClose: () => void;
  /** Share / save through the OS sheet (downloads the file). */
  onShare: () => Promise<unknown>;
};

/**
 * Full-screen picture (documents, expense attachments), the way chat pictures open: pinch to
 * zoom on iOS, Share for the OS sheet, close button clear of the status bar and gesture bar.
 */
export function ImageViewer({ path, filename, onClose, onShare }: Props) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);

  return (
    <Modal
      visible={path !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View testID="image-viewer" className="flex-1 bg-black">
        {path ? (
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AuthedImage
              path={path}
              style={{ width, height: height - insets.top - insets.bottom }}
              resizeMode="contain"
              accessibilityLabel={filename}
            />
          </ScrollView>
        ) : null}
        <View
          style={{ top: insets.top + 8 }}
          className="absolute left-4 right-4 flex-row items-center gap-3"
        >
          <Text className="flex-1 text-sm text-white" numberOfLines={1}>
            {filename}
          </Text>
          <Pressable
            testID="image-viewer-close"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={8}
            className="rounded-full bg-black/60 px-3 py-1"
          >
            <Text className="text-lg text-white">✕</Text>
          </Pressable>
        </View>
        <View
          style={{ paddingBottom: insets.bottom + 16 }}
          className="absolute bottom-0 left-0 right-0 items-center"
        >
          <Pressable
            testID="image-viewer-share"
            accessibilityRole="button"
            disabled={sharing}
            onPress={() => {
              setSharing(true);
              void onShare().finally(() => setSharing(false));
            }}
            className="min-w-[120px] items-center rounded-full bg-white/15 px-5 py-2.5 active:opacity-70"
          >
            {sharing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-sans-medium text-[15px] text-white">
                {t("photos.share")}
              </Text>
            )}
          </Pressable>
        </View>
        {/* A failed share toasts above the viewer, not behind it */}
        <ToastViewport />
      </View>
    </Modal>
  );
}
