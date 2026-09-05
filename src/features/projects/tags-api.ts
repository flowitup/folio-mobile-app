import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";

// Shapes mirror tags/routes.py; list/summary responses are not annotated in the spec.
export type Tag = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type TagSummaryRow = {
  tag_id: string | null;
  tag_name: string | null;
  tag_color: string | null;
  labor_cost: number;
  expense_total: number;
  labor_entry_count: number;
  invoice_count: number;
};

export type TagCreateInput = components["schemas"]["TagCreateBody"];
export type TagUpdateInput = components["schemas"]["TagUpdateBody"];

export const tagKeys = {
  list: (projectId: string) => ["projects", projectId, "tags"] as const,
  summary: (projectId: string) =>
    ["projects", projectId, "tag-summary"] as const,
};

export function useTags(projectId: string) {
  return useQuery({
    queryKey: tagKeys.list(projectId),
    enabled: Boolean(projectId),
    queryFn: async () => {
      const data = unwrapAs<{ items?: Tag[] }>(
        await api.GET("/api/v1/projects/{project_id}/tags", {
          params: { path: { project_id: projectId } },
        }),
      );
      return data.items ?? [];
    },
  });
}

export function useTagSummary(projectId: string) {
  return useQuery({
    queryKey: tagKeys.summary(projectId),
    enabled: Boolean(projectId),
    queryFn: async () => {
      const data = unwrapAs<{ rows?: TagSummaryRow[] }>(
        await api.GET("/api/v1/projects/{project_id}/tag-summary", {
          params: { path: { project_id: projectId } },
        }),
      );
      return data.rows ?? [];
    },
  });
}

export function useCreateTag(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<TagCreateInput, Tag>({
    mutationFn: async (body) =>
      unwrapAs<Tag>(
        await api.POST("/api/v1/projects/{project_id}/tags", {
          params: { path: { project_id: projectId } },
          body,
        }),
      ),
    invalidates: [tagKeys.list(projectId), tagKeys.summary(projectId)],
    successMessage: t("common.saved"),
  });
}

export function useUpdateTag(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ tagId: string } & TagUpdateInput, Tag>({
    mutationFn: async ({ tagId, ...body }) =>
      unwrapAs<Tag>(
        await api.PUT("/api/v1/projects/{project_id}/tags/{tag_id}", {
          params: { path: { project_id: projectId, tag_id: tagId } },
          body,
        }),
      ),
    invalidates: [tagKeys.list(projectId), tagKeys.summary(projectId)],
    successMessage: t("common.saved"),
  });
}

export function useDeleteTag(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ tagId: string }>({
    mutationFn: async ({ tagId }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/projects/{project_id}/tags/{tag_id}", {
          params: { path: { project_id: projectId, tag_id: tagId } },
        }),
      ),
    invalidates: [tagKeys.list(projectId), tagKeys.summary(projectId)],
    successMessage: t("tags.deleted"),
  });
}
