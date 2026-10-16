import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ImageViewer } from "@/components/ui/image-viewer";
import { EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { shareLocalFile } from "@/lib/files/download";
import { resolveViewerFile } from "@/lib/files/open-file";

/**
 * Route for a local picture registered by `openImageViewer` (receipt photos, scanned documents
 * opened through `openFile`), shown in the app's one picture viewer (`ImageViewer`). The route
 * carries an opaque token, like the PDF viewer, so a `folio://image-viewer` link cannot point it
 * anywhere else.
 */
export default function ImageViewerScreen() {
  const { t } = useTranslation();
  const { file, title, mime } = useLocalSearchParams<{
    file?: string;
    title?: string;
    mime?: string;
  }>();
  const uri = useMemo(() => resolveViewerFile(file), [file]);
  const name = title || t("imageViewer.title");

  if (uri === null)
    return (
      <View className="flex-1 bg-paper" testID="image-viewer-missing">
        <ScreenHeader title={name} back />
        <EmptyState message={t("imageViewer.loadError")} />
      </View>
    );

  return (
    <View className="flex-1 bg-black">
      <ImageViewer
        path={null}
        uri={uri}
        filename={name}
        onClose={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
        onShare={() => shareLocalFile(uri, mime || undefined)}
      />
    </View>
  );
}
