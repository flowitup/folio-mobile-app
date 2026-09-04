import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
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
import { pickDocuments } from "@/lib/files/pick";
import type { PickedFile } from "@/lib/files/pick";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Stored reports rarely carry a viewport meta; add one so the WebView renders at phone scale. */
function withMobileViewport(html: string): string {
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) return html;
  const meta =
    '<meta name="viewport" content="width=device-width, initial-scale=1">';
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => `${m}${meta}`)
    : `${meta}${html}`;
}

/** Stored HTML analysis reports: search + tag filter, upload with metadata, inline viewer, edit, delete. */
export default function ProjectAnalysesSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const analyses = useAnalyses(id, { q: search.trim() || undefined, tag });
  const tags = useAnalysisTags(id);
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
    formSheet.current?.present();
  }

  function submit() {
    const trimmed = title.trim();
    const tagList = tagsDraft
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!trimmed) return setError(t("analyses.titleRequired"));
    if (!editing && !file) return setError(t("analyses.fileRequired"));
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
        done,
      );
  }

  const items = analyses.data ?? [];

  return (
    <View className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="p-4 pb-12">
        <View className="mb-2 flex-row items-center gap-2">
          <TextInput
            testID="analyses-search"
            className="flex-1 rounded-lg border border-border px-4 py-2 text-base text-primary"
            placeholder={t("analyses.searchPlaceholder")}
            placeholderTextColor="#a3a3a3"
            value={search}
            onChangeText={setSearch}
          />
          <Button
            testID="analyses-create"
            label="＋"
            size="sm"
            onPress={() => openForm(null)}
          />
        </View>
        <Select
          testID="analyses-tag"
          placeholder={t("documents.allTags")}
          value={tag ?? "__all__"}
          options={[
            { value: "__all__", label: t("documents.allTags") },
            ...(tags.data ?? []).map((value) => ({ value, label: value })),
          ]}
          onChange={(value) => setTag(value === "__all__" ? null : value)}
        />
        {analyses.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {!analyses.isPending && items.length === 0 ? (
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
                {formatDate(analysis.created_at)} ·{" "}
                {Math.round(analysis.size_bytes / 1024)} KB
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
            <View className="mt-2 flex-row gap-4">
              <Pressable
                testID={`analysis-edit-${analysis.id}`}
                onPress={() => openForm(analysis)}
              >
                <Text className="text-sm text-primary">{t("common.edit")}</Text>
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
          </Card>
        ))}
      </ScrollView>

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
                pickDocuments(false, [
                  "text/html",
                  "application/xhtml+xml",
                  "*/*",
                ]).then((result) => {
                  if (result.status === "picked") setFile(result.files[0]);
                  else if (result.status === "denied")
                    showToast(
                      t("invoices.attachments.permissionDenied"),
                      "error",
                    );
                })
              }
            />
          ) : null}
          <Input
            testID="analysis-title"
            label={t("analyses.title")}
            value={title}
            onChangeText={setTitle}
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

      <Modal
        visible={viewing !== null}
        animationType="slide"
        onRequestClose={() => setViewing(null)}
      >
        {viewing ? (
          <View className="flex-1 bg-paper">
            <View className="flex-row items-center border-b border-border px-4 pb-3 pt-14">
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
            {content.isPending ? <ActivityIndicator className="mt-8" /> : null}
            {content.isError ? (
              <Text className="p-4 text-danger">{t("home.loadError")}</Text>
            ) : null}
            {content.data ? (
              <WebView
                originWhitelist={["*"]}
                source={{ html: withMobileViewport(content.data) }}
                style={{ flex: 1 }}
              />
            ) : null}
            <ToastViewport />
          </View>
        ) : null}
      </Modal>
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
    </View>
  );
}
