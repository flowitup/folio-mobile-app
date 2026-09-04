import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import {
  DOCUMENT_KINDS,
  openDocument,
  useDeleteDocument,
  useDocumentTags,
  useDocuments,
  useRenameDocument,
  useSetDocumentTags,
  useUploadDocument,
} from "@/features/documents/documents-api";
import type {
  DocumentSort,
  ProjectDocument,
  ProjectDocumentKind,
} from "@/features/documents/documents-api";
import { captureImage, pickDocuments, pickImages } from "@/lib/files/pick";
import type { PickResult } from "@/lib/files/pick";
import { formatDate } from "@/lib/format/date";
import { useMembers } from "@/features/projects/members-api";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

const SORTS: DocumentSort[] = ["created_at", "name", "size", "uploader"];

/** Project documents: kind chips + tag filter + sort, upload from camera/library/files, open, rename, tags, delete. */
export default function ProjectDocumentsSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [kinds, setKinds] = useState<ProjectDocumentKind[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploader, setUploader] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DocumentSort>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const documents = useDocuments(id, {
    kinds: kinds.length ? kinds : undefined,
    tags: selectedTags.length ? selectedTags : undefined,
    uploaderId: uploader,
    sort,
    order,
    page,
  });
  const members = useMembers(id);
  const totalPages = Math.max(
    1,
    Math.ceil((documents.data?.total ?? 0) / (documents.data?.per_page ?? 25)),
  );
  const toggleTag = (value: string) => {
    setPage(1);
    setSelectedTags((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };
  const tags = useDocumentTags(id);
  const upload = useUploadDocument(id);
  const rename = useRenameDocument(id);
  const setTags = useSetDocumentTags(id);
  const remove = useDeleteDocument(id);
  useRefetchOnFocus(documents.refetch);

  const addSheet = useRef<BottomSheetModal>(null);
  const editSheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<ProjectDocument | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [deleting, setDeleting] = useState<ProjectDocument | null>(null);

  async function handlePick(result: PickResult) {
    addSheet.current?.dismiss();
    if (result.status === "denied")
      return showToast(t("invoices.attachments.permissionDenied"), "error");
    if (result.status === "canceled") return;
    for (const file of result.files)
      await upload.mutateAsync({ file }).catch(() => undefined);
  }

  function openEdit(document: ProjectDocument) {
    setEditing(document);
    setNameDraft(document.filename);
    setTagsDraft(document.tags.join(", "));
    editSheet.current?.present();
  }

  const toggleKind = (kind: ProjectDocumentKind) =>
    setKinds((current) =>
      current.includes(kind)
        ? current.filter((k) => k !== kind)
        : [...current, kind],
    );
  const items = documents.data?.items ?? [];

  return (
    <View className="flex-1 bg-paper">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-11 border-b border-border"
        contentContainerClassName="px-2 items-center"
      >
        {DOCUMENT_KINDS.map((kind) => (
          <Pressable
            key={kind}
            testID={`documents-kind-${kind}`}
            onPress={() => toggleKind(kind)}
            className={`mr-2 rounded-full border px-3 py-1 ${kinds.includes(kind) ? "border-primary bg-primary" : "border-border"}`}
          >
            <Text
              className={
                kinds.includes(kind)
                  ? "text-xs text-primary-foreground"
                  : "text-xs text-primary"
              }
            >
              {t(`documents.kinds.${kind}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {(tags.data?.length ?? 0) > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-11 border-b border-border"
          contentContainerClassName="px-2 items-center"
        >
          {(tags.data ?? []).map((value) => (
            <Pressable
              key={value}
              testID={`documents-tag-${value}`}
              onPress={() => toggleTag(value)}
              className={`mr-2 rounded-full border px-3 py-1 ${selectedTags.includes(value) ? "border-primary bg-primary" : "border-border"}`}
            >
              <Text
                className={
                  selectedTags.includes(value)
                    ? "text-xs text-primary-foreground"
                    : "text-xs text-primary"
                }
              >
                #{value}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-12">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Select
              testID="documents-uploader"
              placeholder={t("documents.allUploaders")}
              value={uploader ?? "__all__"}
              options={[
                { value: "__all__", label: t("documents.allUploaders") },
                ...(members.data ?? []).map((member) => ({
                  value: member.user_id,
                  label: member.display_name ?? member.email,
                })),
              ]}
              onChange={(value) => {
                setPage(1);
                setUploader(value === "__all__" ? null : value);
              }}
            />
          </View>
          <View className="flex-1">
            <Select<DocumentSort>
              testID="documents-sort"
              value={sort}
              options={SORTS.map((value) => ({
                value,
                label: t(`documents.sort.${value}`),
              }))}
              onChange={setSort}
            />
          </View>
          <Button
            testID="documents-order"
            label={order === "desc" ? "↓" : "↑"}
            variant="secondary"
            size="sm"
            className="mb-4"
            onPress={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}
          />
          <Button
            testID="documents-add"
            label="＋"
            size="sm"
            className="mb-4"
            loading={upload.isPending}
            onPress={() => addSheet.current?.present()}
          />
        </View>

        {documents.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {!documents.isPending && items.length === 0 ? (
          <EmptyState message={t("documents.none")} />
        ) : null}
        {items.map((document) => (
          <Card key={document.id} className="mb-2">
            <Pressable
              testID={`document-open-${document.id}`}
              onPress={() =>
                openDocument(document).catch((e: Error) =>
                  showToast(e.message, "error"),
                )
              }
            >
              <View className="flex-row items-center">
                <Badge label={t(`documents.kinds.${document.kind}`)} />
                <Text
                  className="ml-2 flex-1 text-base text-primary"
                  numberOfLines={1}
                >
                  {document.filename}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {Math.round(document.size_bytes / 1024)} KB ·{" "}
                {formatDate(document.uploaded_at)}
              </Text>
            </Pressable>
            {document.tags.length > 0 ? (
              <View className="mt-1 flex-row flex-wrap gap-1">
                {document.tags.map((value) => (
                  <Badge key={value} label={value} />
                ))}
              </View>
            ) : null}
            <View className="mt-2 flex-row gap-4">
              <Pressable
                testID={`document-edit-${document.id}`}
                onPress={() => openEdit(document)}
              >
                <Text className="text-sm text-primary">{t("common.edit")}</Text>
              </Pressable>
              <Pressable
                testID={`document-delete-${document.id}`}
                onPress={() => setDeleting(document)}
              >
                <Text className="text-sm text-danger">
                  {t("common.delete")}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))}
        {(documents.data?.total ?? 0) > (documents.data?.per_page ?? 25) ? (
          <View className="mt-2 flex-row items-center justify-between">
            <Button
              testID="documents-prev"
              label="‹"
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            />
            <Text className="text-xs text-muted-foreground">
              {t("library.pageOf", { page, pages: totalPages })} ·{" "}
              {documents.data?.total ?? 0}
            </Text>
            <Button
              testID="documents-next"
              label="›"
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </View>
        ) : null}
      </ScrollView>

      <Sheet ref={addSheet} title={t("documents.add")} snapPoints={["35%"]}>
        <View className="gap-3 p-4">
          <Button
            testID="documents-camera"
            label={t("invoices.attachments.camera")}
            variant="secondary"
            onPress={() => captureImage().then(handlePick)}
          />
          <Button
            testID="documents-library"
            label={t("invoices.attachments.library")}
            variant="secondary"
            onPress={() => pickImages(true).then(handlePick)}
          />
          <Button
            testID="documents-file"
            label={t("invoices.attachments.document")}
            variant="secondary"
            onPress={() => pickDocuments(true).then(handlePick)}
          />
        </View>
      </Sheet>
      <Sheet ref={editSheet} title={t("documents.edit")} snapPoints={["55%"]}>
        <View className="p-4">
          <Input
            testID="document-name"
            label={t("documents.filename")}
            value={nameDraft}
            onChangeText={setNameDraft}
          />
          <Input
            testID="document-tags"
            label={t("documents.tags")}
            value={tagsDraft}
            onChangeText={setTagsDraft}
            hint={t("documents.tagsHint")}
            autoCapitalize="none"
          />
          <Button
            testID="document-save"
            label={t("common.save")}
            loading={rename.isPending || setTags.isPending}
            onPress={async () => {
              if (!editing) return;
              const nextTags = tagsDraft
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              if (nameDraft.trim() && nameDraft.trim() !== editing.filename)
                await rename
                  .mutateAsync({
                    documentId: editing.id,
                    filename: nameDraft.trim(),
                  })
                  .catch(() => undefined);
              if (nextTags.join("|") !== editing.tags.join("|"))
                await setTags
                  .mutateAsync({ documentId: editing.id, tags: nextTags })
                  .catch(() => undefined);
              editSheet.current?.dismiss();
            }}
          />
        </View>
      </Sheet>
      <ConfirmDialog
        visible={deleting !== null}
        title={t("documents.deleteConfirm", { name: deleting?.filename ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { documentId: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </View>
  );
}
