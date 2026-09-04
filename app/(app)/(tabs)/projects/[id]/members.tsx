import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import {
  useInvitations,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  useRoles,
  useUpdateMemberRole,
} from "@/features/projects/members-api";
import type { ProjectMember } from "@/features/projects/members-api";
import { projectCan, useProject } from "@/features/projects/projects-api";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Members + pending invitations, mirroring the web MembersTable and invite dialog. */
export default function ProjectMembersSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const project = useProject(id);
  const members = useMembers(id);
  const invitations = useInvitations(id);
  const roles = useRoles();
  const updateRole = useUpdateMemberRole(id);
  const removeMember = useRemoveMember(id);
  const invite = useInviteMember(id);
  const revoke = useRevokeInvitation(id);
  useRefetchOnFocus(members.refetch);

  const inviteSheet = useRef<BottomSheetModal>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);

  const canManage =
    projectCan(project.data, "project:manage_users", user?.permissions) ||
    project.data?.owner_id === user?.id;
  const canInvite =
    canManage || projectCan(project.data, "project:invite", user?.permissions);
  const roleOptions = (roles.data ?? []).map((role) => ({
    value: role.id,
    label: role.name,
    description: role.description,
  }));

  function submitInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return setInviteError(t("members.invalidEmail"));
    if (!inviteRoleId) return setInviteError(t("members.roleRequired"));
    setInviteError(null);
    invite.mutate(
      { email, role_id: inviteRoleId },
      {
        onSuccess: () => {
          inviteSheet.current?.dismiss();
          setInviteEmail("");
        },
      },
    );
  }

  if (members.isPending) return <ActivityIndicator className="mt-8" />;

  return (
    <ScrollView className="flex-1 bg-card" contentContainerClassName="p-4">
      {canInvite ? (
        <Button
          testID="members-invite"
          label={t("members.invite")}
          className="mb-4"
          onPress={() => inviteSheet.current?.present()}
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
            <Badge label={member.role_name} />
          </View>
          {canManage && member.user_id !== user?.id ? (
            <View className="mt-3">
              <Select
                testID={`member-role-${member.user_id}`}
                value={member.role_id}
                options={roleOptions}
                placeholder={t("members.changeRole")}
                onChange={(roleId) =>
                  updateRole.mutate({ userId: member.user_id, roleId })
                }
              />
              <Pressable
                testID={`member-remove-${member.user_id}`}
                onPress={() => setRemoving(member)}
              >
                <Text className="text-sm text-danger">
                  {t("members.remove")}
                </Text>
              </Pressable>
            </View>
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
                    {invitation.role_name} ·{" "}
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

      <Sheet ref={inviteSheet} title={t("members.invite")} snapPoints={["60%"]}>
        <View className="p-4">
          <Input
            testID="invite-email"
            label={t("login.email")}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={inviteError}
          />
          <Select
            testID="invite-role"
            label={t("members.role")}
            value={inviteRoleId}
            options={roleOptions}
            onChange={setInviteRoleId}
          />
          <Button
            testID="invite-submit"
            label={t("members.sendInvite")}
            loading={invite.isPending}
            onPress={submitInvite}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={removing !== null}
        title={t("members.removeConfirm", { email: removing?.email ?? "" })}
        confirmLabel={t("members.remove")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={removeMember.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          removeMember.mutate(
            { userId: removing.user_id },
            { onSettled: () => setRemoving(null) },
          )
        }
      />
    </ScrollView>
  );
}
