import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { downloadAndShare } from "@/lib/files/download";
import type { PickedFile } from "@/lib/files/pick";
import { uploadMultipart } from "@/lib/files/upload";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

// Shape mirrors project_photos/routes.py `_serialize`; not annotated in the spec.
export type ProjectPhoto = {
  id: string;
  project_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  caption: string | null;
  captured_at: string;
  uploaded_at: string;
  uploader_id: string;
  thumbnail_url: string;
  original_url: string;
};

export type PhotosPage = {
  items: ProjectPhoto[];
  total: number;
  page: number;
  per_page: number;
};

export const photoKeys = {
  all: (projectId: string) => ["projects", projectId, "photos"] as const,
  list: (projectId: string, page = 1) =>
    ["projects", projectId, "photos", page] as const,
};

export const isVideo = (photo: Pick<ProjectPhoto, "content_type">) =>
  photo.content_type.startsWith("video/");

export function useProjectPhotos(projectId: string, page = 1, perPage = 100) {
  return useQuery({
    queryKey: photoKeys.list(projectId, page),
    queryFn: async () =>
      unwrapAs<PhotosPage>(
        await api.GET("/api/v1/projects/{project_id}/photos", {
          params: {
            path: { project_id: projectId },
            query: { page, per_page: perPage } as never,
          },
        }),
      ),
  });
}

/** Paged gallery with "load more": pages accumulate until `total` is reached (web loadMorePhotosAction). */
export function useProjectPhotosInfinite(projectId: string, perPage = 60) {
  return useInfiniteQuery({
    queryKey: [...photoKeys.all(projectId), "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      unwrapAs<PhotosPage>(
        await api.GET("/api/v1/projects/{project_id}/photos", {
          params: {
            path: { project_id: projectId },
            query: { page: pageParam, per_page: perPage } as never,
          },
        }),
      ),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? last.page + 1 : undefined;
    },
  });
}

/** Multipart `file` + optional `caption` / `captured_at` form fields, as the web upload panel sends. */
export function useUploadPhoto(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    { file: PickedFile; caption?: string; capturedAt?: string },
    ProjectPhoto
  >({
    mutationFn: ({ file, caption, capturedAt }) =>
      uploadMultipart<ProjectPhoto>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/photos`,
        [{ field: "file", file }],
        {
          ...(caption ? { caption } : {}),
          ...(capturedAt ? { captured_at: capturedAt } : {}),
        },
      ),
    invalidates: [photoKeys.all(projectId)],
    successMessage: t("photos.uploaded"),
  });
}

export function useUpdatePhoto(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    { photoId: string; caption?: string | null; capturedAt?: string },
    ProjectPhoto
  >({
    mutationFn: async ({ photoId, caption, capturedAt }) =>
      unwrapAs<ProjectPhoto>(
        await api.PATCH("/api/v1/projects/{project_id}/photos/{photo_id}", {
          params: { path: { project_id: projectId, photo_id: photoId } },
          body: {
            ...(caption !== undefined ? { caption } : {}),
            ...(capturedAt ? { captured_at: capturedAt } : {}),
          } as never,
        }),
      ),
    invalidates: [photoKeys.all(projectId)],
    successMessage: t("common.saved"),
  });
}

export function useDeletePhoto(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ photoId: string }>({
    mutationFn: async ({ photoId }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/projects/{project_id}/photos/{photo_id}", {
          params: { path: { project_id: projectId, photo_id: photoId } },
        }),
      ),
    invalidates: [photoKeys.all(projectId)],
    successMessage: t("photos.deleted"),
  });
}

/** Original file (photo or video) via the OS share/preview sheet. */
export function sharePhoto(photo: ProjectPhoto): Promise<string> {
  return downloadAndShare(photo.original_url, photo.filename);
}
