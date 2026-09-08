import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrap, unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";

// Shapes mirror projects/routes.py (members) and invitations/schemas.py; not in the spec yet.
export type ProjectMember = {
  user_id: string;
  email: string;
  display_name: string | null;
  role_name: string;
  role_id: string | null;
  joined_at: string | null;
};

export type Invitation = {
  id: string;
  email: string;
  role_name: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  invited_by_name: string;
};

export type CreateInviteInput = components["schemas"]["CreateInviteRequest"];
export type CreateInviteResponse =
  components["schemas"]["CreateInviteResponse"];

export const memberKeys = {
  members: (projectId: string) => ["projects", projectId, "members"] as const,
  invitations: (projectId: string) =>
    ["projects", projectId, "invitations"] as const,
};

export function useMembers(projectId: string, enabled = true) {
  return useQuery({
    queryKey: memberKeys.members(projectId),
    enabled: Boolean(projectId) && enabled,
    queryFn: async () => {
      const data = unwrapAs<{ members?: ProjectMember[] }>(
        await api.GET("/api/v1/projects/{project_id}/members", {
          params: { path: { project_id: projectId } },
        }),
      );
      return data.members ?? [];
    },
  });
}

export type AssignmentRole = "member" | "manager";

/**
 * Assign an existing company member to the project (admin: any role; manager: member only).
 * Idempotent: re-assigning with a different role changes it — this is the only "role picker",
 * offered once at assignment time, not a standing per-member role dropdown.
 */
export function useAssignMember(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ userId: string; role: AssignmentRole }>({
    mutationFn: async ({ userId, role }) =>
      unwrapVoid(
        await api.PUT("/api/v1/projects/{project_id}/assignments/{user_id}", {
          params: { path: { project_id: projectId, user_id: userId } },
          body: { role } as never,
        }),
      ),
    invalidates: [memberKeys.members(projectId), ["projects", projectId]],
    successMessage: t("common.saved"),
  });
}

export function useUnassignMember(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ userId: string }>({
    mutationFn: async ({ userId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/projects/{project_id}/assignments/{user_id}",
          { params: { path: { project_id: projectId, user_id: userId } } },
        ),
      ),
    invalidates: [memberKeys.members(projectId), ["projects", projectId]],
    successMessage: t("members.removed"),
  });
}

/** Pending e-mail invitations; the list needs `project:invite` since back-end Phase 3, so callers pass `enabled`. */
export function useInvitations(projectId: string, enabled = true) {
  return useQuery({
    queryKey: memberKeys.invitations(projectId),
    enabled: Boolean(projectId) && enabled,
    queryFn: async () => {
      const data = unwrapAs<{ items?: Invitation[] }>(
        await api.GET("/api/v1/invitations/projects/{project_id}/invitations", {
          params: { path: { project_id: projectId } },
        }),
      );
      return data.items ?? [];
    },
  });
}

/** Invites by email: an existing user is added directly, otherwise an invitation email goes out. */
export function useInviteMember(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    Omit<CreateInviteInput, "project_id">,
    CreateInviteResponse
  >({
    mutationFn: async (body) =>
      unwrap(
        await api.POST("/api/v1/invitations", {
          body: { ...body, project_id: projectId },
        }),
      ),
    invalidates: [
      memberKeys.members(projectId),
      memberKeys.invitations(projectId),
      ["projects", projectId],
    ],
    successMessage: t("members.inviteSent"),
  });
}

export function useRevokeInvitation(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ invitationId: string }>({
    mutationFn: async ({ invitationId }) =>
      unwrapVoid(
        await api.POST("/api/v1/invitations/{invitation_id}/revoke", {
          params: { path: { invitation_id: invitationId } },
        }),
      ),
    invalidates: [memberKeys.invitations(projectId)],
    successMessage: t("members.invitationRevoked"),
  });
}
