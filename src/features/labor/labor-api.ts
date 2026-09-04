import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { invoiceKeys } from "@/features/invoices/invoices-api";
import { downloadAndShare } from "@/lib/files/download";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type {
  BulkLogPayload,
  BulkLogResponse,
  ConflictsResponse,
  CreateLaborActivityPayload,
  CreateRateChangePayload,
  CreateWorkerPayload,
  LaborActivity,
  LaborDayDescription,
  LaborEntry,
  LaborExportFormat,
  LaborMonthlySummaryResponse,
  LaborSummaryResponse,
  LogAttendancePayload,
  UpdateAttendancePayload,
  UpdateWorkerPayload,
  Worker,
  WorkerRateChange,
} from "./labor-types";

export type LaborRole = {
  id: string;
  name: string;
  color: string;
  created_at?: string;
};

export const laborKeys = {
  workers: (p: string) => ["projects", p, "workers"] as const,
  roles: ["labor", "roles"] as const,
  rateChanges: (p: string, w: string) =>
    ["projects", p, "workers", w, "rate-changes"] as const,
  entries: (p: string, from?: string, to?: string) =>
    ["projects", p, "labor-entries", from ?? "", to ?? ""] as const,
  entriesAll: (p: string) => ["projects", p, "labor-entries"] as const,
  activities: (p: string) => ["projects", p, "labor-activities"] as const,
  dayDescriptions: (p: string) =>
    ["projects", p, "labor-day-descriptions"] as const,
  summary: (p: string, from?: string, to?: string) =>
    ["projects", p, "labor-summary", from ?? "", to ?? ""] as const,
  summaryAll: (p: string) => ["projects", p, "labor-summary"] as const,
  monthly: (p: string) => ["projects", p, "labor-monthly-summary"] as const,
};

/** Everything a labor mutation can change: entries, summaries, project totals, labor payments. */
function laborInvalidations(projectId: string) {
  return [
    laborKeys.entriesAll(projectId),
    laborKeys.summaryAll(projectId),
    laborKeys.monthly(projectId),
    invoiceKeys.laborPayments(projectId),
    ["projects", projectId],
  ];
}

// ---- workers ----------------------------------------------------------------

export function useWorkers(projectId: string) {
  return useQuery({
    queryKey: laborKeys.workers(projectId),
    queryFn: async () =>
      unwrapAs<{ workers?: Worker[] }>(
        await api.GET("/api/v1/projects/{project_id}/workers", {
          params: { path: { project_id: projectId } },
        }),
      ).workers ?? [],
  });
}

export function useLaborRoles() {
  return useQuery({
    queryKey: laborKeys.roles,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const data = unwrapAs<{ roles?: LaborRole[]; palette?: string[] }>(
        await api.GET("/api/v1/labor/roles"),
      );
      return { roles: data.roles ?? [], palette: data.palette ?? [] };
    },
  });
}

export function useCreateWorker(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<CreateWorkerPayload, Worker>({
    mutationFn: async (body) =>
      unwrapAs<Worker>(
        await api.POST("/api/v1/projects/{project_id}/workers", {
          params: { path: { project_id: projectId } },
          body: body as never,
        }),
      ),
    invalidates: [laborKeys.workers(projectId)],
    successMessage: t("labor.workers.created"),
  });
}

export function useUpdateWorker(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ workerId: string } & UpdateWorkerPayload, Worker>({
    mutationFn: async ({ workerId, ...body }) =>
      unwrapAs<Worker>(
        await api.PUT("/api/v1/projects/{project_id}/workers/{worker_id}", {
          params: { path: { project_id: projectId, worker_id: workerId } },
          body: body as never,
        }),
      ),
    invalidates: [
      laborKeys.workers(projectId),
      laborKeys.entriesAll(projectId),
    ],
    successMessage: t("common.saved"),
  });
}

export function useDeleteWorker(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ workerId: string }>({
    mutationFn: async ({ workerId }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/projects/{project_id}/workers/{worker_id}", {
          params: { path: { project_id: projectId, worker_id: workerId } },
        }),
      ),
    invalidates: [
      laborKeys.workers(projectId),
      ...laborInvalidations(projectId),
    ],
    successMessage: t("labor.workers.deleted"),
  });
}

export function useRateChanges(projectId: string, workerId: string | null) {
  return useQuery({
    queryKey: laborKeys.rateChanges(projectId, workerId ?? ""),
    enabled: Boolean(workerId),
    queryFn: async () =>
      unwrapAs<{ rate_changes?: WorkerRateChange[] }>(
        await api.GET(
          "/api/v1/projects/{project_id}/workers/{worker_id}/rate-changes",
          {
            params: { path: { project_id: projectId, worker_id: workerId! } },
          },
        ),
      ).rate_changes ?? [],
  });
}

export function useCreateRateChange(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    { workerId: string } & CreateRateChangePayload,
    WorkerRateChange
  >({
    mutationFn: async ({ workerId, ...body }) =>
      unwrapAs<WorkerRateChange>(
        await api.POST(
          "/api/v1/projects/{project_id}/workers/{worker_id}/rate-changes",
          {
            params: { path: { project_id: projectId, worker_id: workerId } },
            body: body as never,
          },
        ),
      ),
    invalidates: [
      laborKeys.workers(projectId),
      ...laborInvalidations(projectId),
    ],
    onSuccess: () => undefined,
    successMessage: t("common.saved"),
  });
}

export function useDeleteRateChange(projectId: string) {
  return useApiMutation<{ workerId: string; rateChangeId: string }>({
    mutationFn: async ({ workerId, rateChangeId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/projects/{project_id}/workers/{worker_id}/rate-changes/{rc_id}",
          {
            params: {
              path: {
                project_id: projectId,
                worker_id: workerId,
                rc_id: rateChangeId,
              },
            },
          },
        ),
      ),
    invalidates: [
      laborKeys.workers(projectId),
      ...laborInvalidations(projectId),
    ],
  });
}

// ---- entries ---------------------------------------------------------------

export function useLaborEntries(projectId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: laborKeys.entries(projectId, from, to),
    queryFn: async () =>
      unwrapAs<{ entries?: LaborEntry[] }>(
        await api.GET("/api/v1/projects/{project_id}/labor-entries", {
          params: {
            path: { project_id: projectId },
            query: { from, to } as never,
          },
        }),
      ).entries ?? [],
  });
}

export function useLogAttendance(projectId: string) {
  return useApiMutation<LogAttendancePayload, LaborEntry>({
    mutationFn: async (body) =>
      unwrapAs<LaborEntry>(
        await api.POST("/api/v1/projects/{project_id}/labor-entries", {
          params: { path: { project_id: projectId } },
          body: body as never,
        }),
      ),
    invalidates: laborInvalidations(projectId),
  });
}

/** Bulk log; a 409 with `conflicts` in the body is surfaced to the caller through `onError`. */
export function useBulkLog(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<BulkLogPayload, BulkLogResponse>({
    mutationFn: async (body) =>
      unwrapAs<BulkLogResponse>(
        await api.POST("/api/v1/projects/{project_id}/labor-entries/bulk", {
          params: { path: { project_id: projectId } },
          body: body as never,
        }),
      ),
    invalidates: laborInvalidations(projectId),
    successMessage: t("labor.log.saved"),
  });
}

export function useUpdateAttendance(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    { entryId: string } & UpdateAttendancePayload,
    LaborEntry
  >({
    mutationFn: async ({ entryId, ...body }) =>
      unwrapAs<LaborEntry>(
        await api.PUT(
          "/api/v1/projects/{project_id}/labor-entries/{entry_id}",
          {
            params: { path: { project_id: projectId, entry_id: entryId } },
            body: body as never,
          },
        ),
      ),
    invalidates: laborInvalidations(projectId),
    successMessage: t("common.saved"),
  });
}

export function useDeleteAttendance(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ entryId: string }>({
    mutationFn: async ({ entryId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/projects/{project_id}/labor-entries/{entry_id}",
          {
            params: { path: { project_id: projectId, entry_id: entryId } },
          },
        ),
      ),
    invalidates: laborInvalidations(projectId),
    successMessage: t("labor.log.entryDeleted"),
  });
}

export async function fetchConflicts(
  projectId: string,
  date: string,
  personIds: string[],
): Promise<ConflictsResponse> {
  return unwrapAs<ConflictsResponse>(
    await api.GET("/api/v1/projects/{project_id}/labor-entries/conflicts", {
      params: {
        path: { project_id: projectId },
        query: { date, person_ids: personIds.join(",") || undefined } as never,
      },
    }),
  );
}

export function useSetDayTag(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ date: string; tagId: string | null }>({
    mutationFn: async ({ date, tagId }) =>
      unwrapAs<unknown>(
        await api.PUT("/api/v1/projects/{project_id}/labor-entries/day-tag", {
          params: { path: { project_id: projectId } },
          body: { date, tag_id: tagId } as never,
        }),
      ),
    invalidates: laborInvalidations(projectId),
    successMessage: t("common.saved"),
  });
}

// ---- activities & day descriptions -----------------------------------------

export function useActivities(projectId: string) {
  return useQuery({
    queryKey: laborKeys.activities(projectId),
    queryFn: async () =>
      unwrapAs<{ activities?: LaborActivity[] }>(
        await api.GET("/api/v1/projects/{project_id}/labor-activities", {
          params: { path: { project_id: projectId } },
        }),
      ).activities ?? [],
  });
}

export function useCreateActivity(projectId: string) {
  return useApiMutation<CreateLaborActivityPayload, LaborActivity>({
    mutationFn: async (body) =>
      unwrapAs<LaborActivity>(
        await api.POST("/api/v1/projects/{project_id}/labor-activities", {
          params: { path: { project_id: projectId } },
          body,
        }),
      ),
    invalidates: [laborKeys.activities(projectId)],
  });
}

export function useUpdateActivity(projectId: string) {
  return useApiMutation<{ activityId: string; title: string }, LaborActivity>({
    mutationFn: async ({ activityId, title }) =>
      unwrapAs<LaborActivity>(
        await api.PUT(
          "/api/v1/projects/{project_id}/labor-activities/{activity_id}",
          {
            params: {
              path: { project_id: projectId, activity_id: activityId },
            },
            body: { title },
          },
        ),
      ),
    invalidates: [laborKeys.activities(projectId)],
  });
}

export function useDeleteActivity(projectId: string) {
  return useApiMutation<{ activityId: string }>({
    mutationFn: async ({ activityId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/projects/{project_id}/labor-activities/{activity_id}",
          {
            params: {
              path: { project_id: projectId, activity_id: activityId },
            },
          },
        ),
      ),
    invalidates: [laborKeys.activities(projectId)],
  });
}

export function useDayDescriptions(projectId: string) {
  return useQuery({
    queryKey: laborKeys.dayDescriptions(projectId),
    queryFn: async () =>
      unwrapAs<{ day_descriptions?: LaborDayDescription[] }>(
        await api.GET("/api/v1/projects/{project_id}/labor-day-descriptions", {
          params: { path: { project_id: projectId } },
        }),
      ).day_descriptions ?? [],
  });
}

/** Empty description deletes the day's note (same PUT, backend semantics). */
export function useSetDayDescription(projectId: string) {
  return useApiMutation<{ date: string; description: string }>({
    mutationFn: async (body) =>
      unwrapAs<unknown>(
        await api.PUT("/api/v1/projects/{project_id}/labor-day-descriptions", {
          params: { path: { project_id: projectId } },
          body,
        }),
      ),
    invalidates: [laborKeys.dayDescriptions(projectId)],
  });
}

// ---- summaries & exports -------------------------------------------------------

export function useLaborSummary(projectId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: laborKeys.summary(projectId, from, to),
    queryFn: async () =>
      unwrapAs<LaborSummaryResponse>(
        await api.GET("/api/v1/projects/{project_id}/labor-summary", {
          params: {
            path: { project_id: projectId },
            query: { from, to } as never,
          },
        }),
      ),
  });
}

export function useLaborMonthlySummary(projectId: string) {
  return useQuery({
    queryKey: laborKeys.monthly(projectId),
    queryFn: async () =>
      unwrapAs<LaborMonthlySummaryResponse>(
        await api.GET("/api/v1/projects/{project_id}/labor-monthly-summary", {
          params: { path: { project_id: projectId } },
        }),
      ),
  });
}

export function exportLabor(
  projectId: string,
  format: LaborExportFormat,
  from: string,
  to: string,
  workerId?: string | null,
) {
  const query = new URLSearchParams({ from, to, format }).toString();
  const path = workerId
    ? `/api/v1/projects/${encodeURIComponent(projectId)}/workers/${encodeURIComponent(workerId)}/labor-export?${query}`
    : `/api/v1/projects/${encodeURIComponent(projectId)}/labor-export?${query}`;
  return downloadAndShare(path, `labor-${from}-${to}.${format}`);
}

// ---- labor roles management (settings) --------------------------------------------------------

export function useCreateLaborRole() {
  const { t } = useTranslation();
  return useApiMutation<{ name: string; color: string }, LaborRole>({
    mutationFn: async (body) =>
      unwrapAs<LaborRole>(
        await api.POST("/api/v1/labor/roles", { body: body as never }),
      ),
    invalidates: [laborKeys.roles],
    successMessage: t("common.saved"),
  });
}

export function useUpdateLaborRole() {
  const { t } = useTranslation();
  return useApiMutation<
    { roleId: string; name?: string; color?: string },
    LaborRole
  >({
    mutationFn: async ({ roleId, ...body }) =>
      unwrapAs<LaborRole>(
        await api.PATCH("/api/v1/labor/roles/{role_id}", {
          params: { path: { role_id: roleId } },
          body: body as never,
        }),
      ),
    invalidates: [laborKeys.roles],
    successMessage: t("common.saved"),
  });
}

export function useDeleteLaborRole() {
  const { t } = useTranslation();
  return useApiMutation<{ roleId: string }>({
    mutationFn: async ({ roleId }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/labor/roles/{role_id}", {
          params: { path: { role_id: roleId } },
        }),
      ),
    invalidates: [laborKeys.roles],
    successMessage: t("common.saved"),
  });
}
