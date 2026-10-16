import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
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
import { isViewableImage as isViewableImageFile } from "@/lib/files/open-file";

/**
 * True when the file is a picture the in-app viewer shows (by MIME type, else by name). One
 * rule for the whole app: the same one `openFile` uses to pick the viewer over the share sheet.
 */
export function isViewableImage(
  mimeType: string | null | undefined,
  filename: string,
): boolean {
  return isViewableImageFile({ filename, mimeType });
}

type Props = {
  /** API path of the picture (authenticated download); null keeps the viewer closed. */
  path: string | null;
  /** A local copy instead of an API path (a file `openFile` already downloaded). */
  uri?: string | null;
  filename: string;
  onClose: () => void;
  /** Share / save through the OS sheet (downloads the file). */
  onShare: () => Promise<unknown>;
};

/**
 * The app's one full-screen picture viewer (documents, expense attachments, and the
 * `/image-viewer` route that `openFile` opens for a downloaded picture), the way chat pictures
 * open: pinch to zoom on iOS, Share for the OS sheet, close button clear of the status bar and
 * gesture bar.
 */
export function ImageViewer({
  path,
  uri = null,
  filename,
  onClose,
  onShare,
}: Props) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const imageStyle = { width, height: height - insets.top - insets.bottom };

  return (
    <Modal
      visible={path !== null || uri !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View testID="image-viewer" className="flex-1 bg-black">
        {uri && failedUri === uri ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-sm text-white">
              {t("imageViewer.loadError")}
            </Text>
          </View>
        ) : path || uri ? (
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
            {uri ? (
              <Image
                testID="image-viewer-image"
                source={{ uri }}
                style={imageStyle}
                resizeMode="contain"
                accessibilityLabel={filename}
                onError={() => setFailedUri(uri)}
              />
            ) : path ? (
              <AuthedImage
                path={path}
                style={imageStyle}
                resizeMode="contain"
                accessibilityLabel={filename}
              />
            ) : null}
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
