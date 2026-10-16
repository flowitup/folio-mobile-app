import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, SearchInput } from "@/components/ui/input";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
} from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { ToastViewport, showToast } from "@/components/ui/toast";
import {
  useAnalyses,
  useAnalysisContent,
  useAnalysisTags,
  useDeleteAnalysis,
  useUpdateAnalysis,
  useUploadAnalysis,
} from "@/features/analyses/analyses-api";
import type { Analysis } from "@/features/analyses/analyses-api";
import {
  isTapMove,
  prepareReportHtml,
  reportNavigation,
} from "@/features/analyses/report-html";
import { useProjectCan } from "@/features/projects/use-project-can";
import { formatFileSize } from "@/lib/format/file-size";
import { pickDocuments } from "@/lib/files/pick";
import {
  ANALYSIS_EXTENSIONS,
  ANALYSIS_PICKER_TYPES,
  uploadErrorMessage,
  uploadProblem,
  uploadProblemMessage,
} from "@/lib/files/upload-rules";
import type { PickedFile } from "@/lib/files/pick";
import { formatInstant } from "@/lib/format/date";
import { useTokens } from "@/theme/tokens";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/**
 * The report WebView. Android reports every navigation as `other`, so a scripted redirect cannot be
 * told from a tapped link by the WebView itself. The only signal the report cannot reach is the
 * native touch stream: React Native's root view forwards every touch to JS even when the WebView
 * consumes it, and a touch always starts before the navigation it causes. A scroll or swipe does
 * not count, and one tap opens at most one link.
 */
function ReportViewer({ html }: { html: string }) {
  const tokens = useTokens();
  // The WebView paints white before the report: keep it hidden on the screen's own background,
  // with the spinner in the same place, until the report has drawn.
  const [drawn, setDrawn] = useState(false);
  const lastTapAt = useRef<number | null>(null);
  const touchFrom = useRef<{ x: number; y: number } | null>(null);
  return (
    <View
      testID="analysis-report"
      style={{ flex: 1 }}
      onTouchStart={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        touchFrom.current = { x: pageX, y: pageY };
        lastTapAt.current = Date.now();
      }}
      onTouchMove={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        if (
          touchFrom.current &&
          !isTapMove(touchFrom.current, { x: pageX, y: pageY })
        )
          lastTapAt.current = null;
      }}
      onTouchEnd={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        if (
          touchFrom.current &&
          !isTapMove(touchFrom.current, { x: pageX, y: pageY })
        )
          lastTapAt.current = null;
      }}
      onTouchCancel={() => {
        lastTapAt.current = null;
      }}
    >
      <WebView
        // Every request reaches the guard below, which keeps the report in place.
        originWhitelist={["*"]}
        source={{ html: prepareReportHtml(html) }}
        onShouldStartLoadWithRequest={(request) => {
          const action = reportNavigation(
            request,
            Platform.OS,
            lastTapAt.current,
          );
          if (action === "external") {
            lastTapAt.current = null;
            Linking.openURL(request.url).catch(() => undefined);
          }
          return action === "allow";
        }}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        onLoadEnd={() => setDrawn(true)}
        style={{
          flex: 1,
          backgroundColor: tokens.paper,
          opacity: drawn ? 1 : 0,
        }}
      />
      {drawn ? null : (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center pt-8"
          style={{ backgroundColor: tokens.paper }}
        >
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}

/**
 * Stored HTML analysis reports: search + tag filter, upload with metadata, inline viewer, edit,
 * delete. Members read the list and the viewer; upload, edit and delete need `project:update`.
 */
export default function ProjectAnalysesSection() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const canWrite = useProjectCan(id, "project:update");
  const tags = useAnalysisTags(id);
  // A tag leaves the picker with its last analysis, which then reads "All tags": stop filtering
  // on it too, or the list stays empty behind that label.
  const activeTag = tag && tags.data && !tags.data.includes(tag) ? null : tag;
  const analyses = useAnalyses(id, {
    q: search.trim() || undefined,
    tag: activeTag,
  });
  const upload = useUploadAnalysis(id);
  const update = useUpdateAnalysis(id);
  const remove = useDeleteAnalysis(id);
  useRefetchOnFocus(analyses.refetch);

  const formSheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<Analysis | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Analysis | null>(null);
  const content = useAnalysisContent(id, viewing?.id ?? null);
  const [deleting, setDeleting] = useState<Analysis | null>(null);

  function openForm(analysis: Analysis | null) {
    setEditing(analysis);
    setFile(null);
    setTitle(analysis?.title ?? "");
    setSummary(analysis?.summary ?? "");
    setSourceUrl(analysis?.source_url ?? "");
    setTagsDraft((analysis?.tags ?? []).join(", "));
    setError(null);
    setFileError(null);
    formSheet.current?.present();
  }

  function submit() {
    const trimmed = title.trim();
    const tagList = tagsDraft
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    setError(null);
    setFileError(null);
    if (!trimmed) return setError(t("analyses.titleRequired"));
    // The file is picked several rows above the title input, so its error belongs there.
    if (!editing && !file) return setFileError(t("analyses.fileRequired"));
    const done = { onSuccess: () => formSheet.current?.dismiss() };
    if (editing)
      update.mutate(
        {
          analysisId: editing.id,
          title: trimmed,
          summary: summary.trim() || null,
          source_url: sourceUrl.trim() || null,
          tags: tagList,
        },
        done,
      );
    else
      upload.mutate(
        {
          file: file!,
          title: trimmed,
          summary: summary.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          tags: tagList,
        },
        {
          ...done,
          // Shown under the file button, naming the file and what is wrong with it.
          onError: (caught) =>
            setFileError(
              uploadErrorMessage(
                caught,
                file!,
                ANALYSIS_EXTENSIONS,
                t,
                i18n.language,
              ),
            ),
        },
      );
  }

  const items = analyses.data ?? [];

  return (
    <View className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="p-4 pb-12">
        <View className="mb-2 flex-row items-center gap-2">
          <SearchInput
            testID="analyses-search"
            className="flex-1"
            placeholder={t("analyses.searchPlaceholder")}
            value={search}
            onChangeText={setSearch}
          />
          {canWrite ? (
            <Button
              testID="analyses-create"
              label="＋"
              size="sm"
              onPress={() => openForm(null)}
            />
          ) : null}
        </View>
        <Select
          testID="analyses-tag"
          placeholder={t("documents.allTags")}
          value={activeTag ?? "__all__"}
          options={[
            { value: "__all__", label: t("documents.allTags") },
            ...(tags.data ?? []).map((value) => ({ value, label: value })),
          ]}
          onChange={(value) => setTag(value === "__all__" ? null : value)}
        />
        {analyses.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {analyses.isError ? (
          <ErrorState
            message={t("analyses.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void analyses.refetch()}
          />
        ) : null}
        {!analyses.isPending && !analyses.isError && items.length === 0 ? (
          <EmptyState message={t("analyses.none")} />
        ) : null}
        {items.map((analysis) => (
          <Card key={analysis.id} className="mb-2">
            <Pressable
              testID={`analysis-open-${analysis.id}`}
              onPress={() => setViewing(analysis)}
            >
              <Text className="text-base font-medium text-primary">
                {analysis.title}
              </Text>
              {analysis.summary ? (
                <Text className="mt-1 text-sm text-primary" numberOfLines={3}>
                  {analysis.summary}
                </Text>
              ) : null}
              <Text className="mt-1 text-xs text-muted-foreground">
                {formatInstant(analysis.created_at)} ·{" "}
                {formatFileSize(analysis.size_bytes)}
                {analysis.source_url ? ` · ${analysis.source_url}` : ""}
              </Text>
            </Pressable>
            {analysis.tags.length > 0 ? (
              <View className="mt-1 flex-row flex-wrap gap-1">
                {analysis.tags.map((value) => (
                  <Badge key={value} label={value} />
                ))}
              </View>
            ) : null}
            {canWrite ? (
              <View className="mt-2 flex-row gap-4">
                <Pressable
                  testID={`analysis-edit-${analysis.id}`}
                  onPress={() => openForm(analysis)}
                >
                  <Text className="text-sm text-primary">
                    {t("common.edit")}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`analysis-delete-${analysis.id}`}
                  onPress={() => setDeleting(analysis)}
                >
                  <Text className="text-sm text-danger">
                    {t("common.delete")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>

      {canWrite ? (
        <Sheet
          ref={formSheet}
          title={editing ? t("analyses.edit") : t("analyses.upload")}
          snapPoints={["85%"]}
        >
          <ScrollView
            contentContainerClassName="p-4"
            keyboardShouldPersistTaps="handled"
          >
            {!editing ? (
              <Button
                testID="analysis-pick-file"
                label={file ? file.name : t("analyses.pickFile")}
                variant="secondary"
                className="mb-4"
                onPress={() =>
                  // HTML only: a PDF or a Word file could be picked before, then failed on save
                  // with "check the form".
                  pickDocuments(false, ANALYSIS_PICKER_TYPES).then((result) => {
                    if (result.status === "picked") {
                      const picked = result.files[0];
                      const problem = uploadProblem(
                        picked,
                        ANALYSIS_EXTENSIONS,
                      );
                      setFile(problem ? null : picked);
                      setFileError(
                        problem
                          ? uploadProblemMessage(
                              picked,
                              problem,
                              ANALYSIS_EXTENSIONS,
                              t,
                            )
                          : null,
                      );
                    } else if (result.status === "denied")
                      showToast(
                        t("invoices.attachments.permissionDenied"),
                        "error",
                      );
                  })
                }
              />
            ) : null}
            {fileError ? (
              <Text
                testID="analysis-file-error"
                className="-mt-3 mb-4 text-sm text-danger"
              >
                {fileError}
              </Text>
            ) : null}
            <Input
              testID="analysis-title"
              label={t("analyses.title")}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setError(null);
              }}
              error={error}
            />
            <Input
              testID="analysis-summary"
              label={t("analyses.summary")}
              value={summary}
              onChangeText={setSummary}
              multiline
            />
            <Input
              testID="analysis-source"
              label={t("analyses.sourceUrl")}
              value={sourceUrl}
              onChangeText={setSourceUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Input
              testID="analysis-tags"
              label={t("documents.tags")}
              value={tagsDraft}
              onChangeText={setTagsDraft}
              hint={t("documents.tagsHint")}
              autoCapitalize="none"
            />
            <Button
              testID="analysis-submit"
              label={t("common.save")}
              loading={upload.isPending || update.isPending}
              onPress={submit}
            />
          </ScrollView>
        </Sheet>
      ) : null}

      <Modal
        visible={viewing !== null}
        animationType="slide"
        onRequestClose={() => setViewing(null)}
        // Same window on both platforms, so the header sits under the status bar by the inset
        // alone and keeps its height while the report loads.
        statusBarTranslucent
      >
        {viewing ? (
          <View className="flex-1 bg-paper">
            <View
              className="flex-row items-center border-b border-border px-4 pb-3"
              style={{ paddingTop: insets.top + 12 }}
            >
              <Text
                className="flex-1 text-lg font-semibold text-primary"
                numberOfLines={1}
              >
                {viewing.title}
              </Text>
              <Pressable
                testID="analysis-close"
                onPress={() => setViewing(null)}
                hitSlop={12}
              >
                <Text className="text-lg text-primary">✕</Text>
              </Pressable>
            </View>
            {/* One body box for every state: nothing below the header moves when the report arrives */}
            <View className="flex-1">
              {content.isPending ? (
                <ActivityIndicator className="mt-8" />
              ) : null}
              {content.isError ? (
                <Text className="p-4 text-danger">
                  {t("analyses.loadError")}
                </Text>
              ) : null}
              {content.data ? (
                <ReportViewer key={viewing.id} html={content.data} />
              ) : null}
            </View>
            <ToastViewport />
          </View>
        ) : null}
      </Modal>
      {canWrite ? (
        <ConfirmDialog
          visible={deleting !== null}
          title={t("analyses.deleteConfirm", { title: deleting?.title ?? "" })}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          destructive
          loading={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            deleting &&
            remove.mutate(
              { analysisId: deleting.id },
              { onSettled: () => setDeleting(null) },
            )
          }
        />
      ) : null}
    </View>
  );
}
