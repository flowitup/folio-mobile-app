import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";

export type TaskStatus =
  "backlog" | "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
/** Same lane order as the web kanban (`BOARD_COLUMNS`). */
export const BOARD_COLUMNS: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "done",
];
export const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

// Shape mirrors tasks/task_routes.py serializer; not annotated in the spec.
export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  labels: string[];
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateTaskInput = components["schemas"]["CreateTaskSchema"];
export type UpdateTaskInput = Partial<{
  title: string;
  description: string | null;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  labels: string[];
}>;

export const taskKeys = {
  list: (p: string) => ["projects", p, "tasks"] as const,
};

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: taskKeys.list(projectId),
    queryFn: async () =>
      unwrapAs<{ tasks?: Task[] }>(
        await api.GET("/api/v1/projects/{project_id}/tasks", {
          params: { path: { project_id: projectId } },
        }),
      ).tasks ?? [],
  });
}

export function useCreateTask(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<CreateTaskInput, Task>({
    mutationFn: async (body) =>
      unwrapAs<Task>(
        await api.POST("/api/v1/projects/{project_id}/tasks", {
          params: { path: { project_id: projectId } },
          body,
        }),
      ),
    invalidates: [taskKeys.list(projectId)],
    successMessage: t("tasks.created"),
  });
}

export function useUpdateTask(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ taskId: string } & UpdateTaskInput, Task>({
    mutationFn: async ({ taskId, ...body }) =>
      unwrapAs<Task>(
        await api.PUT("/api/v1/tasks/{task_id}", {
          params: { path: { task_id: taskId } },
          body: body as never,
        }),
      ),
    invalidates: [taskKeys.list(projectId)],
    successMessage: t("common.saved"),
  });
}

/** Moves a task to a lane; `beforeId` / `afterId` pin the position inside the lane. */
export function useMoveTask(projectId: string) {
  return useApiMutation<
    {
      taskId: string;
      status: TaskStatus;
      beforeId?: string | null;
      afterId?: string | null;
    },
    Task
  >({
    mutationFn: async ({ taskId, status, beforeId, afterId }) =>
      unwrapAs<Task>(
        await api.PATCH("/api/v1/tasks/{task_id}/move", {
          params: { path: { task_id: taskId } },
          body: {
            status,
            before_id: beforeId ?? null,
            after_id: afterId ?? null,
          },
        }),
      ),
    invalidates: [taskKeys.list(projectId)],
  });
}

export function useDeleteTask(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ taskId: string }>({
    mutationFn: async ({ taskId }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/tasks/{task_id}", {
          params: { path: { task_id: taskId } },
        }),
      ),
    invalidates: [taskKeys.list(projectId)],
    successMessage: t("tasks.deleted"),
  });
}
