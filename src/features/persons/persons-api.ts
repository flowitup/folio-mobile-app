import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

export interface PersonSummary {
  id: string;
  name: string;
  phone: string | null;
}

export const personKeys = {
  search: (q: string) => ["persons", q] as const,
};

export function usePersons(q: string, enabled = true) {
  return useQuery({
    queryKey: personKeys.search(q),
    enabled,
    queryFn: async () =>
      unwrapAs<{ persons: PersonSummary[]; total: number }>(
        await api.GET("/api/v1/persons", {
          params: { query: { ...(q ? { q } : {}), limit: 50 } } as never,
        }),
      ).persons,
  });
}

export function useCreatePerson() {
  const { t } = useTranslation();
  return useApiMutation<{ name: string; phone?: string }, PersonSummary>({
    mutationFn: async (body) =>
      unwrapAs<PersonSummary>(
        await api.POST("/api/v1/persons", { body: body as never }),
      ),
    invalidates: [["persons"]],
    successMessage: t("common.saved"),
  });
}

/** Moves every worker of the source person to the target, then deletes the source. */
export function useMergePersons() {
  return useApiMutation<
    { sourceId: string; targetId: string },
    { target_person_id: string; workers_reassigned: number }
  >({
    mutationFn: async ({ sourceId, targetId }) =>
      unwrapAs<{ target_person_id: string; workers_reassigned: number }>(
        await api.POST("/api/v1/persons/{source_person_id}/merge", {
          params: { path: { source_person_id: sourceId } },
          body: { target_person_id: targetId } as never,
        }),
      ),
    invalidates: [["persons"], ["projects"]],
  });
}
