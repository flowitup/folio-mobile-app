import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useMemo, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { isCompanyAdmin } from "@/auth/permissions";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chip";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { useCompanyPersons } from "@/features/companies/company-members-api";
import { useAssignMember } from "@/features/projects/members-api";
import type {
  AssignmentRole,
  ProjectMember,
} from "@/features/projects/members-api";

type Props = {
  projectId: string;
  companyId: string | null | undefined;
  members: ProjectMember[];
};

/**
 * Assign an existing company member to the project (no invitation, no email round-trip —
 * distinct from the outsider "invite by email" flow above it). Only linked accounts (an
 * un-linked pending profile has no `user_id` to assign) not already on the project are offered.
 *
 * `role: "manager"` is not a per-project role: it raises the target's COMPANY role, which the
 * backend allows to company admins alone (403 + full rollback otherwise). So the role picker is
 * shown to a company admin only; anyone else assigns plain members.
 */
export const AssignMemberSheet = forwardRef<BottomSheetModal, Props>(
  function AssignMemberSheet({ projectId, companyId, members }, ref) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const canPromote = isCompanyAdmin(user, companyId);
    const directory = useCompanyPersons(companyId ?? undefined);
    const assign = useAssignMember(projectId);
    const [userId, setUserId] = useState<string | null>(null);
    const [role, setRole] = useState<AssignmentRole>("member");

    const assignedUserIds = useMemo(
      () => new Set(members.map((m) => m.user_id)),
      [members],
    );
    const candidates = useMemo(
      () =>
        (directory.data ?? []).filter(
          (person) =>
            person.linked_user_id &&
            !assignedUserIds.has(person.linked_user_id),
        ),
      [directory.data, assignedUserIds],
    );

    function submit() {
      if (!userId) return;
      assign.mutate(
        { userId, role: canPromote ? role : "member" },
        {
          onSuccess: () => {
            setUserId(null);
            setRole("member");
            (
              ref as RefObject<BottomSheetModal | null> | null
            )?.current?.dismiss();
          },
        },
      );
    }

    return (
      <Sheet ref={ref} title={t("members.assign.title")} snapPoints={["60%"]}>
        <View className="p-4">
          {!companyId ? (
            <EmptyState message={t("members.assign.noCompany")} />
          ) : (
            <>
              {/* The picker mounts unconditionally, together with the Sheet: registering a
                  stacked bottom-sheet modal (the Select's own picker sheet) after the parent is
                  already presented corrupts gorhom's push stack. Loading/empty/error states for
                  the directory query render alongside it instead of gating it. */}
              <Select
                testID="assign-member-person"
                label={t("members.assign.personLabel")}
                placeholder={t("members.assign.personPlaceholder")}
                value={userId}
                options={candidates.map((person) => ({
                  value: person.linked_user_id!,
                  label: person.name,
                }))}
                onChange={setUserId}
              />
              {directory.isPending ? (
                <ActivityIndicator className="my-4" />
              ) : null}
              {directory.isError ? (
                <ErrorState
                  message={t("members.assign.loadError")}
                  retryLabel={t("common.retry")}
                  onRetry={() => void directory.refetch()}
                />
              ) : null}
              {!directory.isPending &&
              !directory.isError &&
              candidates.length === 0 ? (
                <EmptyState message={t("members.assign.empty")} />
              ) : null}
              {canPromote ? (
                <>
                  <Text className="mb-1.5 font-sans text-[12px] text-muted">
                    {t("members.assign.roleLabel")}
                  </Text>
                  <Segmented<AssignmentRole>
                    testID="assign-member-role"
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: "member", label: t("companies.x.member") },
                      { value: "manager", label: t("companies.x.manager") },
                    ]}
                  />
                </>
              ) : null}
              <Button
                testID="assign-member-submit"
                label={t("members.assign.submit")}
                className="mt-4"
                loading={assign.isPending}
                disabled={!userId}
                onPress={submit}
              />
            </>
          )}
        </View>
      </Sheet>
    );
  },
);
