import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AuthedImage } from "@/components/ui/authed-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageViewer, isViewableImage } from "@/components/ui/image-viewer";
import { Input } from "@/components/ui/input";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
} from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import {
  DOCUMENT_KINDS,
  openDocument,
  uploaderLabel,
  useDeleteDocument,
  useDocumentTags,
  useDocumentUploaders,
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
import { formatFileSize } from "@/lib/format/file-size";
import { captureImage, pickDocuments, pickImages } from "@/lib/files/pick";
import type { PickResult } from "@/lib/files/pick";
import { fileExtension, renameProblem } from "@/lib/files/rename-rules";
import {
  DOCUMENT_EXTENSIONS,
  DOCUMENT_PICKER_TYPES,
  uploadEach,
} from "@/lib/files/upload-rules";
import { formatInstant } from "@/lib/format/date";
import { useProjectCan } from "@/features/projects/use-project-can";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { apiErrorMessage } from "@/lib/query/api-error-message";
import { useOpeningFile } from "@/lib/files/use-opening-file";

const SORTS: DocumentSort[] = ["created_at", "name", "size", "uploader"];

/** Focus refetch target while the caller may not read documents — the query stays disabled. */
const noRefetch = () => undefined;

/**
 * Project documents: kind chips + tag filter + sort, upload from camera/library/files, open,
 * rename, tags, delete. The whole area — reading included — needs `project:update`, so a caller
 * without it lands on an empty state and no document request is made.
 */
export default function ProjectDocumentsSection() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [kinds, setKinds] = useState<ProjectDocumentKind[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploader, setUploader] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DocumentSort>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const canAccess = useProjectCan(id, "project:update");
  const tags = useDocumentTags(id, canAccess);
  // A tag leaves the project the moment its last document is deleted or retagged, and the
  // chip row disappears with the last tag. Still filtering on it would empty the list with no
  // chip left on screen to clear it, so only tags the project still offers narrow the list.
  const knownTags = tags.data;
  const activeTags = useMemo(
    () =>
      knownTags
        ? selectedTags.filter((value) => knownTags.includes(value))
        : selectedTags,
    [selectedTags, knownTags],
  );
  // Built from the documents themselves: an unassigned company admin who uploaded is listed too.
  const uploaders = useDocumentUploaders(id, canAccess);
  // Same for the author: once their last document is gone they leave the picker, which then
  // reads "All authors"; still sending their id would list nothing behind that label.
  const activeUploader =
    uploader &&
    uploaders.data &&
    !uploaders.data.some((who) => who.user_id === uploader)
      ? null
      : uploader;
  const documents = useDocuments(
    id,
    {
      kinds: kinds.length ? kinds : undefined,
      tags: activeTags.length ? activeTags : undefined,
      uploaderId: activeUploader,
      sort,
      order,
      page,
    },
    canAccess,
  );
  const totalPages = Math.max(
    1,
    Math.ceil((documents.data?.total ?? 0) / (documents.data?.per_page ?? 25)),
  );
  // Deleting the only document of the last page leaves the page past the end, with the pager
  // hidden: fall back to the last page that still exists once the fresh total is known.
  if (documents.data && !documents.isPlaceholderData && page > totalPages)
    setPage(totalPages);
  const toggleTag = (value: string) => {
    setPage(1);
    setSelectedTags((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };
  const upload = useUploadDocument(id);
  const rename = useRenameDocument(id);
  const setTags = useSetDocumentTags(id);
  const remove = useDeleteDocument(id);
  useRefetchOnFocus(canAccess ? documents.refetch : noRefetch);

  const addSheet = useRef<BottomSheetModal>(null);
  const editSheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<ProjectDocument | null>(null);
  const opener = useOpeningFile();
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [tagsDraft, setTagsDraft] = useState("");
  const [deleting, setDeleting] = useState<ProjectDocument | null>(null);
  const [viewing, setViewing] = useState<ProjectDocument | null>(null);
  // The viewer's Share: the OS sheet, reusing the downloaded copy.
  const share = (document: ProjectDocument) =>
    openDocument(document, { share: true }).catch((e: unknown) =>
      showToast(apiErrorMessage(e, t, i18n.language), "error"),
    );

  async function handlePick(result: PickResult) {
    addSheet.current?.dismiss();
    if (result.status === "denied")
      return showToast(t("invoices.attachments.permissionDenied"), "error");
    if (result.status === "canceled") return;
    // A .doc, a .zip or an empty file is refused here, by name, without a doomed upload.
    const problems = await uploadEach(
      result.files,
      DOCUMENT_EXTENSIONS,
      (file) => upload.mutateAsync({ file }),
      t,
      i18n.language,
    );
    if (problems.length) showToast(problems.join("\n"), "error");
  }

  function openEdit(document: ProjectDocument) {
    setEditing(document);
    setNameDraft(document.filename);
    setNameError(null);
    setTagsDraft(document.tags.join(", "));
    editSheet.current?.present();
  }

  // Every filter and every ordering change starts the listing over: page 3 of the previous
  // narrowing can be past the end of the new one, which reads as an empty section.
  const toggleKind = (kind: ProjectDocumentKind) => {
    setPage(1);
    setKinds((current) =>
      current.includes(kind)
        ? current.filter((k) => k !== kind)
        : [...current, kind],
    );
  };
  const changeSort = (next: DocumentSort) => {
    setPage(1);
    setSort(next);
  };
  const toggleOrder = () => {
    setPage(1);
    setOrder((current) => (current === "desc" ? "asc" : "desc"));
  };
  const items = documents.data?.items ?? [];

  if (!canAccess)
    return (
      <View className="flex-1 bg-paper">
        <EmptyState message={t("documents.restricted")} />
      </View>
    );

  return (
    <View className="flex-1 bg-paper">
      {/* The kinds wrap onto a second line: in a scrolling row the last chip was cut ("Khá…")
          with nothing saying the row scrolls. */}
      <View
        testID="documents-kinds"
        className="flex-row flex-wrap gap-y-2 border-b border-border px-2 py-2"
      >
        {DOCUMENT_KINDS.map((kind) => (
          <Pressable
            key={kind}
            testID={`documents-kind-${kind}`}
            accessibilityRole="button"
            accessibilityState={{ selected: kinds.includes(kind) }}
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
      </View>
      {(tags.data?.length ?? 0) > 0 ? (
        <ScrollView
          horizontal
          // Many tags overflow the row: the indicator says it scrolls.
          showsHorizontalScrollIndicator
          persistentScrollbar
          className="max-h-11 border-b border-border"
          contentContainerClassName="pl-2 pr-6 items-center"
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
              value={activeUploader ?? "__all__"}
              options={[
                { value: "__all__", label: t("documents.allUploaders") },
                ...(uploaders.data ?? []).map((who) => ({
                  value: who.user_id,
                  label: uploaderLabel(who) ?? t("documents.formerUploader"),
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
              onChange={changeSort}
            />
          </View>
          <Button
            testID="documents-order"
            label={order === "desc" ? "↓" : "↑"}
            variant="secondary"
            size="sm"
            className="mb-4"
            onPress={toggleOrder}
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
        {documents.isError ? (
          <ErrorState
            message={t("documents.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void documents.refetch()}
          />
        ) : null}
        {!documents.isPending && !documents.isError && items.length === 0 ? (
          <EmptyState message={t("documents.none")} />
        ) : null}
        {items.map((document) => (
          <Card key={document.id} className="mb-2">
            <Pressable
              testID={`document-open-${document.id}`}
              accessibilityState={{ busy: opener.openingId === document.id }}
              // A picture opens full screen at once (Share from there); other files download
              // (or reuse the copy already downloaded) and open in the PDF viewer or share sheet.
              onPress={() =>
                isViewableImage(document.content_type, document.filename)
                  ? setViewing(document)
                  : void opener
                      .run(document.id, () => openDocument(document))
                      .catch((e: unknown) =>
                        showToast(
                          apiErrorMessage(e, t, i18n.language),
                          "error",
                        ),
                      )
              }
            >
              <View className="flex-row items-center">
                {isViewableImage(document.content_type, document.filename) ? (
                  <AuthedImage
                    testID={`document-thumb-${document.id}`}
                    path={document.download_url}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      marginRight: 8,
                    }}
                    resizeMode="cover"
                  />
                ) : null}
                <Badge label={t(`documents.kinds.${document.kind}`)} />
                <Text
                  className="ml-2 flex-1 text-base text-primary"
                  numberOfLines={1}
                >
                  {document.filename}
                </Text>
                {/* The file downloads before the viewer opens: show the tap was taken. */}
                {opener.openingId === document.id ? (
                  <ActivityIndicator
                    testID={`document-opening-${document.id}`}
                    size="small"
                  />
                ) : null}
              </View>
              <Text className="text-xs text-muted-foreground">
                {formatFileSize(document.size_bytes)} ·{" "}
                {formatInstant(document.uploaded_at)}
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
            onPress={() =>
              pickDocuments(true, DOCUMENT_PICKER_TYPES).then(handlePick)
            }
          />
        </View>
      </Sheet>
      <Sheet ref={editSheet} title={t("documents.edit")} snapPoints={["55%"]}>
        <View className="p-4">
          <Input
            testID="document-name"
            label={t("documents.filename")}
            value={nameDraft}
            onChangeText={(value) => {
              setNameError(null);
              setNameDraft(value);
            }}
            error={nameError}
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
              // A blank name keeps the current one; a changed extension is refused by the
              // backend, so it is caught here with a translated message.
              if (
                nameDraft.trim() &&
                renameProblem(editing.filename, nameDraft) === "extension"
              )
                return setNameError(
                  t("common.errors.keepExtension", {
                    ext: fileExtension(editing.filename),
                  }),
                );
              const nextTags = tagsDraft
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              // Each step stops the save on failure and keeps the sheet open with what was
              // typed: the rename first, so a refused name does not leave the tags half saved.
              // Neither step toasts on success; one "Saved." once both are through.
              let saved = false;
              if (nameDraft.trim() && nameDraft.trim() !== editing.filename) {
                try {
                  await rename.mutateAsync({
                    documentId: editing.id,
                    filename: nameDraft.trim(),
                  });
                  saved = true;
                } catch (caught) {
                  return setNameError(
                    apiErrorMessage(caught, t, i18n.language),
                  );
                }
              }
              if (nextTags.join("|") !== editing.tags.join("|")) {
                try {
                  await setTags.mutateAsync({
                    documentId: editing.id,
                    tags: nextTags,
                  });
                  saved = true;
                } catch {
                  // The mutation already told the user; keep the sheet open to retry.
                  return;
                }
              }
              if (saved) showToast(t("common.saved"), "success");
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
      <ImageViewer
        path={viewing?.download_url ?? null}
        filename={viewing?.filename ?? ""}
        onClose={() => setViewing(null)}
        onShare={() => (viewing ? share(viewing) : Promise.resolve())}
      />
    </View>
  );
}
