import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
} from "@/components/ui/primitives";
import { AssignMemberSheet } from "@/features/projects/assign-member-sheet";
import {
  useInvitations,
  useMembers,
  useRevokeInvitation,
  useUnassignMember,
} from "@/features/projects/members-api";
import type {
  Invitation,
  ProjectMember,
} from "@/features/projects/members-api";
import { projectCan, useProject } from "@/features/projects/projects-api";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/**
 * Members: manager/member assignments (D1 — no role picker, assigned once from the company
 * directory). Admin is implicit on every company project and never listed here. Someone not yet
 * a company member is onboarded from the company members screen ("add by phone", D1) first;
 * outstanding legacy email invitations stay visible here to revoke, but the mobile app no longer
 * creates new ones — that flow needs a legacy project role id this redesign is retiring.
 */
export default function ProjectMembersSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const project = useProject(id);
  const members = useMembers(id);
  const invitations = useInvitations(
    id,
    project.isSuccess &&
      projectCan(project.data, "project:invite", user?.permissions),
  );
  const unassign = useUnassignMember(id);
  const revoke = useRevokeInvitation(id);
  useRefetchOnFocus(members.refetch);

  const assignSheet = useRef<BottomSheetModal>(null);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  const [revoking, setRevoking] = useState<Invitation | null>(null);

  // Assigning and unassigning are `project:manage_users` alone on the backend; `project:invite`
  // only opens the legacy invitation list, which is why it no longer widens this gate.
  const canManage = projectCan(
    project.data,
    "project:manage_users",
    user?.permissions,
  );
  const canInvite = projectCan(
    project.data,
    "project:invite",
    user?.permissions,
  );

  if (members.isPending) return <ActivityIndicator className="mt-8" />;
  if (members.isError)
    return (
      <View className="flex-1 bg-paper">
        <ErrorState
          message={t("members.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void members.refetch()}
        />
      </View>
    );

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="p-4">
      {canManage ? (
        <Button
          testID="members-assign"
          label={t("members.assign.title")}
          className="mb-4"
          onPress={() => assignSheet.current?.present()}
        />
      ) : null}

      <Text className="mb-2 text-sm font-medium text-muted-foreground">
        {t("members.title", { count: members.data?.length ?? 0 })}
      </Text>
      {members.data?.length === 0 ? (
        <EmptyState message={t("members.none")} />
      ) : null}
      {members.data?.map((member) => (
        <Card key={member.user_id} className="mb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text
                className="text-base font-medium text-primary"
                numberOfLines={1}
              >
                {member.display_name || member.email}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {member.email}
              </Text>
              {member.joined_at ? (
                <Text className="text-xs text-muted-foreground">
                  {t("members.joined", { date: formatDate(member.joined_at) })}
                </Text>
              ) : null}
            </View>
            <Badge
              label={t(`companies.x.${member.role_name}`, {
                defaultValue: member.role_name,
              })}
            />
          </View>
          {canManage && member.user_id !== user?.id ? (
            <Button
              testID={`member-remove-${member.user_id}`}
              label={t("members.remove")}
              variant="secondary"
              size="sm"
              className="mt-2"
              onPress={() => setRemoving(member)}
            />
          ) : null}
        </Card>
      ))}

      {invitations.data && invitations.data.length > 0 ? (
        <>
          <Text className="mb-2 mt-4 text-sm font-medium text-muted-foreground">
            {t("members.pendingInvitations")}
          </Text>
          {invitations.data.map((invitation) => (
            <Card key={invitation.id} className="mb-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base text-primary" numberOfLines={1}>
                    {invitation.email}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t("members.expires", {
                      date: formatDate(invitation.expires_at),
                    })}
                  </Text>
                </View>
                {canInvite && invitation.status === "pending" ? (
                  <Button
                    testID={`invitation-revoke-${invitation.id}`}
                    label={t("members.revoke")}
                    variant="secondary"
                    size="sm"
                    onPress={() => setRevoking(invitation)}
                  />
                ) : (
                  <Badge label={invitation.status} />
                )}
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {/* Mounted only for a caller who can assign: the sheet loads the company directory,
          which the backend reserves for a company admin or manager. */}
      {canManage ? (
        <AssignMemberSheet
          ref={assignSheet}
          projectId={id}
          companyId={project.data?.company_id}
          members={members.data ?? []}
        />
      ) : null}

      <ConfirmDialog
        visible={revoking !== null}
        title={t("members.revokeConfirm", { email: revoking?.email ?? "" })}
        confirmLabel={t("members.revoke")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={revoke.isPending}
        onCancel={() => setRevoking(null)}
        onConfirm={() =>
          revoking &&
          revoke.mutate(
            { invitationId: revoking.id },
            { onSettled: () => setRevoking(null) },
          )
        }
      />
      <ConfirmDialog
        visible={removing !== null}
        title={t("members.removeConfirm", { email: removing?.email ?? "" })}
        confirmLabel={t("members.remove")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={unassign.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          unassign.mutate(
            { userId: removing.user_id },
            { onSettled: () => setRemoving(null) },
          )
        }
      />
    </ScrollView>
  );
}
