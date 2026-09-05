import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";

export type NoteCategory =
  "inspection" | "delivery" | "payment" | "decision" | "call" | "general";
export const NOTE_CATEGORIES: NoteCategory[] = [
  "inspection",
  "delivery",
  "payment",
  "decision",
  "call",
  "general",
];
export type NoteStatus = "open" | "done";

// Shape mirrors notes/routes.py serializer; not annotated in the spec.
export type Note = {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: NoteCategory;
  status: NoteStatus | null;
  created_at: string;
  updated_at: string;
};

export type NoteCreateInput = components["schemas"]["NoteCreateBody"];
/** Partial patch (the generated type marks every nullable field as required). */
export type NoteUpdateInput = Partial<{
  title: string;
  description: string | null;
  category: NoteCategory;
  status: NoteStatus;
}>;

/** Due-reminder notification (legacy notes carrying a due_date), user-scoped. */
export type DueNotification = {
  note: Note & { due_date?: string | null };
  dismissed: boolean;
};

/** A worker-submitted attendance entry waiting for the caller (a manager) to validate. */
export type AttendancePending = {
  kind: "attendance_pending";
  entry_id: string;
  project_id: string;
  project_name: string;
  worker_id: string;
  worker_name: string;
  date: string;
  shift_type: "full" | "half" | "overtime" | null;
  supplement_hours: number;
  note: string | null;
  submitted_at: string;
};

export type NotificationsResponse = {
  items: DueNotification[];
  attendance_pending: AttendancePending[];
  count: number;
};

export const noteKeys = {
  list: (p: string) => ["projects", p, "notes"] as const,
  notifications: ["notifications"] as const,
};

export function useNotes(projectId: string) {
  return useQuery({
    queryKey: noteKeys.list(projectId),
    enabled: Boolean(projectId),
    queryFn: async () =>
      unwrapAs<{ items?: Note[] }>(
        await api.GET("/api/v1/projects/{project_id}/notes", {
          params: { path: { project_id: projectId } },
        }),
      ).items ?? [],
  });
}

export function useCreateNote(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<NoteCreateInput, Note>({
    mutationFn: async (body) =>
      unwrapAs<Note>(
        await api.POST("/api/v1/projects/{project_id}/notes", {
          params: { path: { project_id: projectId } },
          body,
        }),
      ),
    invalidates: [noteKeys.list(projectId)],
    successMessage: t("notes.created"),
  });
}

export function useUpdateNote(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ noteId: string } & NoteUpdateInput, Note>({
    mutationFn: async ({ noteId, ...body }) =>
      unwrapAs<Note>(
        await api.PATCH("/api/v1/projects/{project_id}/notes/{note_id}", {
          params: { path: { project_id: projectId, note_id: noteId } },
          body: body as never,
        }),
      ),
    invalidates: [noteKeys.list(projectId)],
    successMessage: t("common.saved"),
  });
}

export function useDeleteNote(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ noteId: string }>({
    mutationFn: async ({ noteId }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/projects/{project_id}/notes/{note_id}", {
          params: { path: { project_id: projectId, note_id: noteId } },
        }),
      ),
    invalidates: [noteKeys.list(projectId)],
    successMessage: t("notes.deleted"),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: noteKeys.notifications,
    // Pending attendance arrives while the app is open; poll so the bell dot shows up.
    refetchInterval: 60_000,
    queryFn: async () => {
      const body = unwrapAs<Partial<NotificationsResponse>>(
        await api.GET("/api/v1/notifications"),
      );
      return {
        items: body.items ?? [],
        attendance_pending: body.attendance_pending ?? [],
        count: body.count ?? 0,
      } satisfies NotificationsResponse;
    },
  });
}

export function useDismissNotification() {
  return useApiMutation<{ noteId: string }>({
    mutationFn: async ({ noteId }) =>
      unwrapAs<unknown>(
        await api.POST("/api/v1/notifications/{note_id}/dismiss", {
          params: { path: { note_id: noteId } },
        }),
      ),
    invalidates: [noteKeys.notifications],
  });
}
