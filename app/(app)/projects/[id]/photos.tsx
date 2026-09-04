import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
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

import { AuthedImage } from "@/components/ui/authed-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { ToastViewport, showToast } from "@/components/ui/toast";
import {
  isVideo,
  sharePhoto,
  useDeletePhoto,
  useProjectPhotosInfinite,
  useUpdatePhoto,
  useUploadPhoto,
} from "@/features/photos/photos-api";
import type { ProjectPhoto } from "@/features/photos/photos-api";
import { captureImage, pickImages } from "@/lib/files/pick";
import type { PickResult } from "@/lib/files/pick";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Site photos: date-grouped thumbnail grid, camera / library upload, lightbox with caption edit, share, delete. */
export default function ProjectPhotosSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const photos = useProjectPhotosInfinite(id);
  const upload = useUploadPhoto(id);
  const update = useUpdatePhoto(id);
  const remove = useDeletePhoto(id);
  useRefetchOnFocus(photos.refetch);

  const addSheet = useRef<BottomSheetModal>(null);
  const [open, setOpen] = useState<ProjectPhoto | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, ProjectPhoto[]>();
    for (const photo of photos.data?.pages.flatMap((page) => page.items) ??
      []) {
      const key = photo.captured_at.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), photo]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [photos.data]);

  async function handlePick(result: PickResult) {
    addSheet.current?.dismiss();
    if (result.status === "denied")
      return showToast(t("invoices.attachments.permissionDenied"), "error");
    if (result.status === "canceled") return;
    for (const file of result.files)
      await upload.mutateAsync({ file }).catch(() => undefined);
  }

  const cell = Math.floor((width - 32 - 8) / 3);

  return (
    <View className="flex-1 bg-card">
      <ScrollView contentContainerClassName="p-4 pb-12">
        <Button
          testID="photos-add"
          label={t("photos.add")}
          className="mb-4"
          loading={upload.isPending}
          onPress={() => addSheet.current?.present()}
        />
        {photos.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {!photos.isPending && groups.length === 0 ? (
          <EmptyState message={t("photos.none")} />
        ) : null}
        {groups.map(([day, items]) => (
          <View key={day} className="mb-4">
            <Text className="mb-2 text-sm font-medium text-muted-foreground">
              {formatDate(day)}
            </Text>
            <View className="flex-row flex-wrap gap-1">
              {items.map((photo) => (
                <Pressable
                  key={photo.id}
                  testID={`photo-${photo.id}`}
                  onPress={() => {
                    setOpen(photo);
                    setCaptionDraft(photo.caption ?? "");
                  }}
                  style={{ width: cell, height: cell }}
                  className="overflow-hidden rounded bg-muted"
                >
                  <AuthedImage
                    path={photo.thumbnail_url}
                    style={{ width: cell, height: cell }}
                    resizeMode="cover"
                  />
                  {isVideo(photo) ? (
                    <Text className="absolute bottom-1 right-1 text-xs text-white">
                      ▶
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {photos.hasNextPage ? (
          <Button
            testID="photos-load-more"
            label={t("photos.loadMore")}
            variant="secondary"
            loading={photos.isFetchingNextPage}
            onPress={() => void photos.fetchNextPage()}
          />
        ) : null}
      </ScrollView>

      <Sheet ref={addSheet} title={t("photos.add")} snapPoints={["30%"]}>
        <View className="gap-3 p-4">
          <Button
            testID="photos-camera"
            label={t("invoices.attachments.camera")}
            variant="secondary"
            onPress={() => captureImage().then(handlePick)}
          />
          <Button
            testID="photos-library"
            label={t("invoices.attachments.library")}
            variant="secondary"
            onPress={() => pickImages(true, true).then(handlePick)}
          />
        </View>
      </Sheet>

      {/* Lightbox: original (or video poster via thumbnail), caption edit, share, delete */}
      <Modal
        visible={open !== null}
        animationType="slide"
        onRequestClose={() => setOpen(null)}
      >
        {open ? (
          <View className="flex-1 bg-black">
            <Pressable
              testID="lightbox-close"
              onPress={() => setOpen(null)}
              className="absolute right-4 top-12 z-10 rounded-full bg-black/60 px-3 py-1"
            >
              <Text className="text-lg text-white">✕</Text>
            </Pressable>
            <View className="flex-1 items-center justify-center">
              <AuthedImage
                path={isVideo(open) ? open.thumbnail_url : open.original_url}
                style={{ width, height: width }}
                resizeMode="contain"
              />
              {isVideo(open) ? (
                <Text className="mt-2 text-white">{t("photos.videoHint")}</Text>
              ) : null}
            </View>
            <View className="bg-card p-4">
              <Text className="mb-2 text-xs text-muted-foreground">
                {formatDate(open.captured_at)} · {open.filename}
              </Text>
              <Input
                testID="photo-caption"
                label={t("photos.caption")}
                value={captionDraft}
                onChangeText={setCaptionDraft}
              />
              <View className="flex-row gap-2">
                <Button
                  testID="photo-caption-save"
                  label={t("common.save")}
                  size="sm"
                  loading={update.isPending}
                  disabled={captionDraft === (open.caption ?? "")}
                  onPress={() =>
                    update.mutate(
                      {
                        photoId: open.id,
                        caption: captionDraft.trim() || null,
                      },
                      { onSuccess: (updated) => setOpen(updated) },
                    )
                  }
                />
                <Button
                  testID="photo-share"
                  label={t("photos.share")}
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    sharePhoto(open).catch((e: Error) =>
                      showToast(e.message, "error"),
                    )
                  }
                />
                <Button
                  testID="photo-delete"
                  label={t("common.delete")}
                  variant="danger"
                  size="sm"
                  onPress={() => setConfirmDelete(true)}
                />
              </View>
            </View>
            <ConfirmDialog
              visible={confirmDelete}
              title={t("photos.deleteConfirm")}
              confirmLabel={t("common.delete")}
              cancelLabel={t("common.cancel")}
              destructive
              loading={remove.isPending}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={() =>
                remove.mutate(
                  { photoId: open.id },
                  {
                    onSuccess: () => {
                      setConfirmDelete(false);
                      setOpen(null);
                    },
                  },
                )
              }
            />
            <ToastViewport />
          </View>
        ) : null}
      </Modal>
    </View>
  );
}
