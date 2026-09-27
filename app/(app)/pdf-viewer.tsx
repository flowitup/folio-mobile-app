import { useQuery } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { WebView } from "react-native-webview";

import { Icon } from "@/components/ui/icon";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { showToast } from "@/components/ui/toast";
import { bytesToBase64 } from "@/lib/files/base64";
import { shareLocalFile } from "@/lib/files/download";
import { resolveViewerFile } from "@/lib/files/open-file";
import {
  buildPdfJsHtml,
  parsePdfViewerMessage,
  pdfTransferMessages,
} from "@/lib/files/pdf";
import { loadPdfJsScripts } from "@/lib/files/pdfjs-sources";
import { useTokens } from "@/theme/tokens";

/** A page that never reports back (dead renderer, stuck script) turns into the error state. */
const RENDER_TIMEOUT_MS = 30_000;

/**
 * Full-screen viewer for a local PDF registered by `openPdfViewer`; the route only carries an
 * opaque token, so a `folio://pdf-viewer` link cannot point it anywhere else. iOS WKWebView
 * renders the file natively; Android's WebView cannot, so there a pdf.js page (bundled with
 * the app, so offline too) draws it once the file is streamed in. The header's Share button
 * still hands the file to other apps.
 */
export default function PdfViewerScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { file, title } = useLocalSearchParams<{
    file?: string;
    title?: string;
  }>();
  const uri = useMemo(() => resolveViewerFile(file), [file]);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const webView = useRef<WebView>(null);

  const android = Platform.OS === "android";
  const background = tokens.paper2;
  const page = useQuery({
    queryKey: ["pdf-viewer", background],
    queryFn: async () => buildPdfJsHtml(background, await loadPdfJsScripts()),
    enabled: android && uri !== null,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  });
  const folder = useMemo(
    () => (uri && !android ? new File(uri).parentDirectory.uri : undefined),
    [uri, android],
  );

  const waiting = uri !== null && !rendered && !failed && !page.isError;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setFailed(true), RENDER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waiting, attempt]);

  /** Streams the document into the pdf.js page once it reports `ready`. */
  async function sendDocument() {
    if (!uri) return;
    try {
      const bytes = await new File(uri).bytes();
      for (const message of pdfTransferMessages(bytes, bytesToBase64))
        webView.current?.postMessage(message);
    } catch {
      setFailed(true);
    }
  }

  async function share() {
    if (!uri || sharing) return;
    setSharing(true);
    try {
      await shareLocalFile(uri, "application/pdf");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setSharing(false);
    }
  }
  const retry = () => {
    setFailed(false);
    setRendered(false);
    setAttempt((n) => n + 1);
    if (page.isError) void page.refetch();
  };

  const error = failed || page.isError;
  return (
    <View className="flex-1 bg-paper" testID="pdf-viewer">
      <ScreenHeader
        title={title || t("pdfViewer.title")}
        back
        right={
          uri ? (
            <Pressable
              testID="pdf-viewer-share"
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
      {uri === null ? (
        // Unknown token: a stale or forged link, nothing to retry.
        <EmptyState message={t("pdfViewer.loadError")} />
      ) : error ? (
        <ErrorState
          message={t("pdfViewer.loadError")}
          retryLabel={t("common.retry")}
          onRetry={retry}
        />
      ) : (
        <View className="flex-1" style={{ backgroundColor: background }}>
          {android ? (
            page.data ? (
              <WebView
                key={attempt}
                ref={webView}
                testID="pdf-viewer-webview"
                originWhitelist={["*"]}
                source={{
                  html: page.data,
                  baseUrl: "https://folio.pdf-viewer.local/",
                }}
                onMessage={(event) => {
                  const message = parsePdfViewerMessage(event.nativeEvent.data);
                  if (message?.type === "ready") void sendDocument();
                  if (message?.type === "loaded") setRendered(true);
                  if (message?.type === "error") setFailed(true);
                }}
                onError={() => setFailed(true)}
                onRenderProcessGone={() => setFailed(true)}
                setBuiltInZoomControls
                setDisplayZoomControls={false}
                style={{ flex: 1, backgroundColor: background }}
              />
            ) : null
          ) : (
            <WebView
              key={attempt}
              testID="pdf-viewer-webview"
              // Only the local file loads here; links inside the PDF open in the system instead.
              originWhitelist={["file://*"]}
              source={{ uri }}
              allowingReadAccessToURL={folder}
              allowFileAccess
              onLoadEnd={() => setRendered(true)}
              onError={() => setFailed(true)}
              onContentProcessDidTerminate={() => setFailed(true)}
              style={{ flex: 1, backgroundColor: background }}
            />
          )}
          {!rendered ? (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center"
            >
              <ActivityIndicator color={tokens.muted} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
