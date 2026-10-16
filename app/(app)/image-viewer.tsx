import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { showToast } from "@/components/ui/toast";
import { shareLocalFile } from "@/lib/files/download";
import { resolveViewerFile } from "@/lib/files/open-file";
import { useTokens } from "@/theme/tokens";

/**
 * Full-screen viewer for a local picture registered by `openImageViewer` (receipt photos,
 * scanned documents): before it, a tap on one only opened the share sheet. The route carries
 * an opaque token, like the PDF viewer, so a `folio://image-viewer` link cannot point it
 * anywhere else. Pinch to zoom (iOS); the header's Share button hands the file to other apps.
 */
export default function ImageViewerScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { file, title, mime } = useLocalSearchParams<{
    file?: string;
    title?: string;
    mime?: string;
  }>();
  const uri = useMemo(() => resolveViewerFile(file), [file]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function share() {
    if (!uri || sharing) return;
    setSharing(true);
    try {
      await shareLocalFile(uri, mime || undefined);
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setSharing(false);
    }
  }

  return (
    <View className="flex-1 bg-paper" testID="image-viewer">
      <ScreenHeader
        title={title || t("imageViewer.title")}
        back
        right={
          uri ? (
            <Pressable
              testID="image-viewer-share"
              accessibilityRole="button"
              accessibilityLabel={t("pdfViewer.share")}
              disabled={sharing}
              onPress={() => void share()}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center active:opacity-70"
            >
              <Icon name="share" size={20} color={tokens.ink} />
            </Pressable>
          ) : null
        }
      />
      {uri === null || failed ? (
        <EmptyState message={t("imageViewer.loadError")} />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          maximumZoomScale={5}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image
            testID="image-viewer-image"
            source={{ uri }}
            resizeMode="contain"
            accessibilityLabel={title || t("imageViewer.title")}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{ flex: 1, width: "100%", minHeight: 300 }}
          />
          {!loaded ? (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center"
            >
              <ActivityIndicator color={tokens.muted} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
