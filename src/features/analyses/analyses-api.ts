import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { authedFetch } from "@/api/authed-fetch";
import { API_BASE_URL } from "@/config/env";
import type { PickedFile } from "@/lib/files/pick";
import { uploadMultipart } from "@/lib/files/upload";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";

// Shape mirrors project_analyses/routes.py serializer; not annotated in the spec.
export type Analysis = {
  id: string;
  project_id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  tags: string[];
  size_bytes: number;
  content_url: string;
  uploader_id: string;
  created_at: string;
  updated_at: string;
};

export type AnalysisUpdateInput = components["schemas"]["AnalysisUpdateBody"];
export type AnalysisListParams = {
  q?: string;
  tag?: string | null;
  sort?: "created_at" | "title";
  order?: "asc" | "desc";
};

export const analysisKeys = {
  all: (p: string) => ["projects", p, "analyses"] as const,
  list: (p: string, params: AnalysisListParams) =>
    ["projects", p, "analyses", params] as const,
  tags: (p: string) => ["projects", p, "analysis-tags"] as const,
  content: (p: string, id: string) =>
    ["projects", p, "analyses", id, "content"] as const,
};

export function useAnalyses(
  projectId: string,
  params: AnalysisListParams = {},
) {
  return useQuery({
    queryKey: analysisKeys.list(projectId, params),
    queryFn: async () =>
      unwrapAs<{ items?: Analysis[]; total?: number }>(
        await api.GET("/api/v1/projects/{project_id}/analyses", {
          params: {
            path: { project_id: projectId },
            query: {
              q: params.q || undefined,
              tag: params.tag ?? undefined,
              sort: params.sort,
              order: params.order,
              per_page: 100,
            } as never,
          },
        }),
      ).items ?? [],
  });
}

export function useAnalysisTags(projectId: string) {
  return useQuery({
    queryKey: analysisKeys.tags(projectId),
    queryFn: async () =>
      unwrapAs<{ tags?: string[] } | string[]>(
        await api.GET("/api/v1/projects/{project_id}/analyses/tags", {
          params: { path: { project_id: projectId } },
        }),
      ),
    select: (data) => (Array.isArray(data) ? data : (data.tags ?? [])),
  });
}

/** Stored HTML report, fetched with the Bearer token so the WebView can render it inline. */
export function useAnalysisContent(
  projectId: string,
  analysisId: string | null,
) {
  return useQuery({
    queryKey: analysisKeys.content(projectId, analysisId ?? ""),
    enabled: Boolean(analysisId),
    queryFn: async () => {
      const response = await authedFetch(
        `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId!)}/content`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },
  });
}

/** Multipart: `file` (HTML) + `title` + optional `summary`, `source_url`, repeated `tags`. */
export function useUploadAnalysis(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    {
      file: PickedFile;
      title: string;
      summary?: string;
      sourceUrl?: string;
      tags?: string[];
    },
    Analysis
  >({
    mutationFn: ({ file, title, summary, sourceUrl, tags }) =>
      uploadMultipart<Analysis>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/analyses`,
        [{ field: "file", file }],
        {
          title,
          ...(summary ? { summary } : {}),
          ...(sourceUrl ? { source_url: sourceUrl } : {}),
          ...(tags && tags.length ? { tags } : {}),
        },
      ),
    invalidates: [analysisKeys.all(projectId), analysisKeys.tags(projectId)],
    successMessage: t("analyses.uploaded"),
  });
}

export function useUpdateAnalysis(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    { analysisId: string } & Partial<AnalysisUpdateInput>,
    Analysis
  >({
    mutationFn: async ({ analysisId, ...body }) =>
      unwrapAs<Analysis>(
        await api.PATCH(
          "/api/v1/projects/{project_id}/analyses/{analysis_id}",
          {
            params: {
              path: { project_id: projectId, analysis_id: analysisId },
            },
            body: body as never,
          },
        ),
      ),
    invalidates: [analysisKeys.all(projectId), analysisKeys.tags(projectId)],
    successMessage: t("common.saved"),
  });
}

export function useDeleteAnalysis(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ analysisId: string }>({
    mutationFn: async ({ analysisId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/projects/{project_id}/analyses/{analysis_id}",
          {
            params: {
              path: { project_id: projectId, analysis_id: analysisId },
            },
          },
        ),
      ),
    invalidates: [analysisKeys.all(projectId), analysisKeys.tags(projectId)],
    successMessage: t("analyses.deleted"),
  });
}
