import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { authedFetch } from "@/api/authed-fetch";
import { API_BASE_URL } from "@/config/env";
import { downloadAndShare } from "@/lib/files/download";
import type { PickedFile } from "@/lib/files/pick";
import { uploadMultipart } from "@/lib/files/upload";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

// Shapes mirror the web `project-documents.ts` and project_documents/routes.py `_serialize`.
export type ProjectDocumentKind =
  "pdf" | "image" | "spreadsheet" | "doc" | "cad" | "text" | "other";
export const DOCUMENT_KINDS: ProjectDocumentKind[] = [
  "pdf",
  "image",
  "spreadsheet",
  "doc",
  "cad",
  "text",
  "other",
];

export type ProjectDocument = {
  id: string;
  project_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: ProjectDocumentKind;
  uploaded_at: string;
  uploader_id: string;
  download_url: string;
  tags: string[];
};

export type DocumentSort = "name" | "size" | "created_at" | "uploader";
export type DocumentListParams = {
  kinds?: ProjectDocumentKind[];
  tags?: string[];
  sort?: DocumentSort;
  order?: "asc" | "desc";
  page?: number;
};
export type DocumentsPage = {
  items: ProjectDocument[];
  total: number;
  page: number;
  per_page: number;
};

export const documentKeys = {
  all: (p: string) => ["projects", p, "documents"] as const,
  list: (p: string, params: DocumentListParams) =>
    ["projects", p, "documents", params] as const,
  tags: (p: string) => ["projects", p, "document-tags"] as const,
};

/** Kinds and tags repeat as `type=` / `tag=` query params, as the backend expects. */
function documentsQuery(params: DocumentListParams): string {
  const query = new URLSearchParams();
  for (const kind of params.kinds ?? []) query.append("type", kind);
  for (const tag of params.tags ?? []) query.append("tag", tag);
  if (params.sort) query.set("sort", params.sort);
  if (params.order) query.set("order", params.order);
  if (params.page) query.set("page", String(params.page));
  return query.toString();
}

export function useDocuments(
  projectId: string,
  params: DocumentListParams = {},
) {
  return useQuery({
    queryKey: documentKeys.list(projectId, params),
    queryFn: async () => {
      const response = await authedFetch(
        `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/documents?${documentsQuery(params)}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as DocumentsPage;
    },
  });
}

export function useDocumentTags(projectId: string) {
  return useQuery({
    queryKey: documentKeys.tags(projectId),
    queryFn: async () =>
      unwrapAs<{ tags?: string[] }>(
        await api.GET("/api/v1/projects/{project_id}/documents/tags", {
          params: { path: { project_id: projectId } },
        }),
      ).tags ?? [],
  });
}

/** Direct multipart upload (`file` part); the presigned flow stays available in `lib/files/upload`. */
export function useUploadDocument(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ file: PickedFile }, ProjectDocument>({
    mutationFn: ({ file }) =>
      uploadMultipart<ProjectDocument>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/documents`,
        [{ field: "file", file }],
      ),
    invalidates: [documentKeys.all(projectId), documentKeys.tags(projectId)],
    successMessage: t("documents.uploaded"),
  });
}

export function useRenameDocument(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    { documentId: string; filename: string },
    ProjectDocument
  >({
    mutationFn: async ({ documentId, filename }) =>
      unwrapAs<ProjectDocument>(
        await api.PATCH(
          "/api/v1/projects/{project_id}/documents/{document_id}/rename",
          {
            params: {
              path: { project_id: projectId, document_id: documentId },
            },
            body: { filename } as never,
          },
        ),
      ),
    invalidates: [documentKeys.all(projectId)],
    successMessage: t("common.saved"),
  });
}

export function useSetDocumentTags(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    { documentId: string; tags: string[] },
    ProjectDocument
  >({
    mutationFn: async ({ documentId, tags }) =>
      unwrapAs<ProjectDocument>(
        await api.PUT(
          "/api/v1/projects/{project_id}/documents/{document_id}/tags",
          {
            params: {
              path: { project_id: projectId, document_id: documentId },
            },
            body: { tags } as never,
          },
        ),
      ),
    invalidates: [documentKeys.all(projectId), documentKeys.tags(projectId)],
    successMessage: t("common.saved"),
  });
}

export function useDeleteDocument(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ documentId: string }>({
    mutationFn: async ({ documentId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/projects/{project_id}/documents/{document_id}",
          {
            params: {
              path: { project_id: projectId, document_id: documentId },
            },
          },
        ),
      ),
    invalidates: [documentKeys.all(projectId), documentKeys.tags(projectId)],
    successMessage: t("documents.deleted"),
  });
}

/** Downloads through the API (Bearer) and opens the OS share/preview sheet. */
export function openDocument(document: ProjectDocument): Promise<string> {
  return downloadAndShare(document.download_url, document.filename);
}
