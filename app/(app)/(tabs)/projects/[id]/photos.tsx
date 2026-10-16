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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthedImage } from "@/components/ui/authed-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
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
import { useProjectCan } from "@/features/projects/use-project-can";
import { captureImage, pickImages } from "@/lib/files/pick";
import type { PickResult } from "@/lib/files/pick";
import { PHOTO_EXTENSIONS, uploadEach } from "@/lib/files/upload-rules";
import { formatDate, localDayKey, toIsoDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { apiErrorMessage } from "@/lib/query/api-error-message";
import { usePullToRefresh } from "@/lib/query/use-pull-to-refresh";
import { projectKeys } from "@/features/projects/projects-api";

/** Noon on that device-local day: a corrected date stays on its day in any nearby time zone. */
function capturedAtOnDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12, 0, 0).toISOString();
}

/**
 * Site photos: date-grouped thumbnail grid, camera / library upload, lightbox with caption edit,
 * share, delete. Every member may look at the grid and the lightbox; upload, caption edit and
 * delete need `project:update`.
 */
export default function ProjectPhotosSection() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const canWrite = useProjectCan(id, "project:update");
  const photos = useProjectPhotosInfinite(id);
  const upload = useUploadPhoto(id);
  const update = useUpdatePhoto(id);
  const remove = useDeletePhoto(id);
  useRefetchOnFocus(photos.refetch);
  const pullToRefresh = usePullToRefresh([projectKeys.all]);

  const addSheet = useRef<BottomSheetModal>(null);
  const [open, setOpen] = useState<ProjectPhoto | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [dayDraft, setDayDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, ProjectPhoto[]>();
    for (const photo of photos.data?.pages.flatMap((page) => page.items) ??
      []) {
      // The device's calendar day, like every other "today" in the app (not the UTC day of the
      // timestamp): a photo taken in the evening in Vietnam sits under the day it was taken.
      const key = localDayKey(photo.captured_at);
      map.set(key, [...(map.get(key) ?? []), photo]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [photos.data]);

  async function handlePick(result: PickResult) {
    addSheet.current?.dismiss();
    if (result.status === "denied")
      return showToast(t("invoices.attachments.permissionDenied"), "error");
    if (result.status === "canceled") return;
    // The picker names photos itself, so only the server's answer is checked, file by file.
    const problems = await uploadEach(
      result.files,
      PHOTO_EXTENSIONS,
      (file) => upload.mutateAsync({ file }),
      t,
      i18n.language,
      false,
    );
    if (problems.length) showToast(problems.join("\n"), "error");
  }

  const cell = Math.floor((width - 32 - 8) / 3);

  return (
    <View className="flex-1 bg-paper">
      <ScrollView
        refreshControl={pullToRefresh}
        contentContainerClassName="p-4 pb-12"
      >
        {canWrite ? (
          <Button
            testID="photos-add"
            label={t("photos.add")}
            className="mb-4"
            loading={upload.isPending}
            onPress={() => addSheet.current?.present()}
          />
        ) : (
          // Adding, editing and deleting photos need the project edit right: say so instead of
          // leaving a bare "No photos yet." with no button.
          <Text
            testID="photos-read-only"
            className="mb-4 text-sm text-muted-foreground"
          >
            {t("photos.readOnly")}
          </Text>
        )}
        {photos.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {photos.isError ? (
          <ErrorState
            message={t("photos.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void photos.refetch()}
          />
        ) : null}
        {!photos.isPending && !photos.isError && groups.length === 0 ? (
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
                    setDayDraft(localDayKey(photo.captured_at));
                  }}
                  style={{ width: cell, height: cell }}
                  className="overflow-hidden rounded bg-paper-2"
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

      {canWrite ? (
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
      ) : null}

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
              style={{ top: insets.top + 12 }}
              className="absolute right-4 z-10 rounded-full bg-black/60 px-3 py-1"
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
            {/* Clear of the Android gesture bar / iOS home indicator */}
            <View
              className="bg-card p-4"
              style={{ paddingBottom: 16 + insets.bottom }}
            >
              <Text className="mb-2 text-xs text-muted-foreground">
                {formatDate(localDayKey(open.captured_at))} · {open.filename}
              </Text>
              {canWrite ? (
                <DatePicker
                  testID="photo-date"
                  label={t("photos.takenOn")}
                  value={dayDraft || null}
                  onChange={(day) => setDayDraft(day ?? dayDraft)}
                  maximumDate={toIsoDate(new Date())}
                />
              ) : null}
              {canWrite ? (
                <Input
                  testID="photo-caption"
                  label={t("photos.caption")}
                  value={captionDraft}
                  onChangeText={setCaptionDraft}
                  // Same cap as the web caption field and the API
                  maxLength={500}
                />
              ) : open.caption ? (
                <Text className="mb-3 text-base text-primary">
                  {open.caption}
                </Text>
              ) : null}
              <View className="flex-row gap-2">
                {canWrite ? (
                  <Button
                    testID="photo-caption-save"
                    label={t("common.save")}
                    size="sm"
                    loading={update.isPending}
                    disabled={
                      captionDraft === (open.caption ?? "") &&
                      dayDraft === localDayKey(open.captured_at)
                    }
                    onPress={() =>
                      update.mutate(
                        {
                          photoId: open.id,
                          caption: captionDraft.trim() || null,
                          ...(dayDraft &&
                          dayDraft !== localDayKey(open.captured_at)
                            ? { capturedAt: capturedAtOnDay(dayDraft) }
                            : {}),
                        },
                        {
                          onSuccess: (updated) => {
                            setOpen(updated);
                            setDayDraft(localDayKey(updated.captured_at));
                          },
                        },
                      )
                    }
                  />
                ) : null}
                <Button
                  testID="photo-share"
                  label={t("photos.share")}
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    sharePhoto(open).catch((e: unknown) =>
                      showToast(apiErrorMessage(e, t, i18n.language), "error"),
                    )
                  }
                />
                {canWrite ? (
                  <Button
                    testID="photo-delete"
                    label={t("common.delete")}
                    variant="danger"
                    size="sm"
                    onPress={() => setConfirmDelete(true)}
                  />
                ) : null}
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
