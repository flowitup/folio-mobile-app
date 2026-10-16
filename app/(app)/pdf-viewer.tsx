import { useQuery } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import { WebView } from "react-native-webview";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { showToast } from "@/components/ui/toast";
import { bytesToBase64 } from "@/lib/files/base64";
import { shareLocalFile } from "@/lib/files/download";
import { resolveViewerFile } from "@/lib/files/open-file";
import {
  buildPdfJsHtml,
  isPermanentPdfError,
  parsePdfViewerMessage,
  pdfAssetMessage,
  pdfTransferMessages,
  type PdfAssetKind,
} from "@/lib/files/pdf";
import { loadPdfAsset, loadPdfJsScripts } from "@/lib/files/pdfjs-sources";
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
  // A damaged file or a refused password: Retry would fail the same way, offer "Open with…".
  const [permanent, setPermanent] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const webView = useRef<WebView>(null);

  const android = Platform.OS === "android";
  const background = tokens.paper2;
  const labels = useMemo(
    () => ({
      password: t("pdfViewer.passwordPrompt"),
      wrongPassword: t("pdfViewer.wrongPassword"),
      open: t("pdfViewer.open"),
    }),
    [t],
  );
  const page = useQuery({
    queryKey: ["pdf-viewer", background, labels],
    queryFn: async () =>
      buildPdfJsHtml(background, await loadPdfJsScripts(), labels),
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

  /** Hands the page a CMap or font it asked for (or says it has none, so pdf.js falls back). */
  async function sendAsset(kind: PdfAssetKind, name: string) {
    let base64: string | undefined;
    try {
      base64 = await loadPdfAsset(kind, name);
    } catch {
      base64 = undefined;
    }
    webView.current?.postMessage(pdfAssetMessage(kind, name, base64));
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
    setPermanent(false);
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
      ) : error && permanent ? (
        <EmptyState
          message={t("pdfViewer.cannotOpen")}
          action={
            <Button
              testID="pdf-viewer-open-with"
              label={t("pdfViewer.openWith")}
              variant="secondary"
              size="sm"
              onPress={() => void share()}
            />
          }
        />
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
                  // The page shows its password form: stop the spinner and the timeout.
                  if (message?.type === "password") setRendered(true);
                  if (message?.type === "asset")
                    void sendAsset(message.kind, message.name);
                  if (message?.type === "error") {
                    setPermanent(isPermanentPdfError(message.name));
                    setFailed(true);
                  }
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
              // WKWebView draws its "1 of N" page pill over the top of the document; start
              // the first page below it. The pill follows the app's declared localizations
              // (CFBundleLocalizations in app.json), so it speaks French and Vietnamese too.
              contentInset={{ top: 40 }}
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
