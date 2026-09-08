import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { AssignMemberSheet } from "@/features/projects/assign-member-sheet";
import {
  useInvitations,
  useMembers,
  useRevokeInvitation,
  useUnassignMember,
} from "@/features/projects/members-api";
import type { ProjectMember } from "@/features/projects/members-api";
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
    projectCan(project.data, "project:invite", user?.permissions),
  );
  const unassign = useUnassignMember(id);
  const revoke = useRevokeInvitation(id);
  useRefetchOnFocus(members.refetch);

  const assignSheet = useRef<BottomSheetModal>(null);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);

  const canManage =
    projectCan(project.data, "project:manage_users", user?.permissions) ||
    projectCan(project.data, "project:invite", user?.permissions);

  if (members.isPending) return <ActivityIndicator className="mt-8" />;

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
                {canManage && invitation.status === "pending" ? (
                  <Button
                    testID={`invitation-revoke-${invitation.id}`}
                    label={t("members.revoke")}
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      revoke.mutate({ invitationId: invitation.id })
                    }
                  />
                ) : (
                  <Badge label={invitation.status} />
                )}
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <AssignMemberSheet
        ref={assignSheet}
        projectId={id}
        companyId={project.data?.company_id}
        members={members.data ?? []}
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
