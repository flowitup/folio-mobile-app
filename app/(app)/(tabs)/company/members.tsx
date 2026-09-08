import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { Eyebrow } from "@/components/ui/typography";
import { AddMemberByPhoneSheet } from "@/features/companies/add-member-by-phone-sheet";
import {
  useBootAttachedUser,
  useCompany,
  useMyCompanies,
  useSetMemberRole,
} from "@/features/companies/companies-api";
import {
  useAttachedUsers,
  useCompanyPersons,
} from "@/features/companies/company-members-api";
import type { AttachedUser } from "@/features/companies/company-members-api";
import {
  JoinCodeCard,
  MemberRow,
  PendingPersonRow,
} from "@/features/companies/company-members-parts";
import { ImportMembersSheet } from "@/features/companies/import-members-sheet";
import { MemberGrantsSheet } from "@/features/companies/member-grants-sheet";
import { memberDisplayName } from "@/lib/companies/member-display";

/**
 * Company members management (admin only): role per member, D8 custom scope, add by phone,
 * import from another company the caller also admins, and the shared join code (D1).
 */
export default function CompanyMembersScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const companies = useMyCompanies();
  const adminCompanies = useMemo(
    () => (companies.data ?? []).filter((c) => c.role === "admin"),
    [companies.data],
  );
  const [companyId, setCompanyId] = useState<string | null>(null);
  const activeCompanyId = companyId ?? adminCompanies[0]?.id ?? null;

  const company = useCompany(activeCompanyId ?? undefined);
  const users = useAttachedUsers(activeCompanyId ?? undefined);
  const persons = useCompanyPersons(activeCompanyId ?? undefined);
  const pendingPersons = useMemo(
    () => (persons.data ?? []).filter((person) => person.pending),
    [persons.data],
  );
  const setRole = useSetMemberRole();
  const boot = useBootAttachedUser();

  const [booting, setBooting] = useState<AttachedUser | null>(null);
  const [grantsMember, setGrantsMember] = useState<AttachedUser | null>(null);
  const addSheet = useRef<BottomSheetModal>(null);
  const importSheet = useRef<BottomSheetModal>(null);
  const grantsSheet = useRef<BottomSheetModal>(null);

  if (companies.isPending)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title={t("companies.members.title")} back />
        <ActivityIndicator className="mt-8" />
      </View>
    );

  if (adminCompanies.length === 0)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title={t("companies.members.title")} back />
        <EmptyState message={t("settings.users.permissionDenied")} />
      </View>
    );

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("companies.members.title")} back />
      <ScrollView contentContainerClassName="p-4 pb-12">
        {adminCompanies.length > 1 ? (
          <Select
            testID="members-company-picker"
            label={t("companies.members.companyLabel")}
            value={activeCompanyId}
            options={adminCompanies.map((c) => ({
              value: c.id,
              label: c.legal_name,
            }))}
            onChange={setCompanyId}
          />
        ) : null}

        {activeCompanyId ? (
          <JoinCodeCard companyId={activeCompanyId} company={company.data} />
        ) : null}

        <View className="mb-4 flex-row flex-wrap gap-2">
          <Button
            testID="members-add-by-phone"
            label={t("companies.members.addByPhone.title")}
            onPress={() => addSheet.current?.present()}
          />
          {adminCompanies.length > 1 ? (
            <Button
              testID="members-import"
              label={t("companies.members.import.title")}
              variant="secondary"
              onPress={() => importSheet.current?.present()}
            />
          ) : null}
        </View>

        <Eyebrow className="mb-2">
          {t("companies.members.listTitle", {
            count: users.data?.length ?? 0,
          })}
        </Eyebrow>
        {users.isPending ? <ActivityIndicator className="my-4" /> : null}
        {users.isFetched && users.data?.length === 0 ? (
          <EmptyState message={t("companies.admin.manage.attached.empty")} />
        ) : null}
        {(users.data ?? []).map((member) => (
          <MemberRow
            key={member.user_id}
            member={member}
            isSelf={member.user_id === user?.id}
            onChangeRole={(role) =>
              activeCompanyId &&
              setRole.mutate({
                companyId: activeCompanyId,
                userId: member.user_id,
                role,
              })
            }
            onOpenGrants={() => {
              setGrantsMember(member);
              grantsSheet.current?.present();
            }}
            onBoot={() => setBooting(member)}
          />
        ))}

        {/* Add-by-phone with no existing/other-company match creates a `pending` profile (no
            `linked_user_id` yet) — the attached-users list above never shows it, so without
            this section the admin has no confirmation the add worked until the person signs up. */}
        <Eyebrow className="mb-2 mt-4">
          {t("companies.members.pending.title", {
            count: pendingPersons.length,
          })}
        </Eyebrow>
        {persons.isPending ? <ActivityIndicator className="my-4" /> : null}
        {persons.isFetched && pendingPersons.length === 0 ? (
          <EmptyState message={t("companies.members.pending.empty")} />
        ) : null}
        {pendingPersons.map((person) => (
          <PendingPersonRow key={person.person_id} person={person} />
        ))}
      </ScrollView>

      {activeCompanyId ? (
        <>
          <AddMemberByPhoneSheet ref={addSheet} companyId={activeCompanyId} />
          <ImportMembersSheet ref={importSheet} companyId={activeCompanyId} />
          <MemberGrantsSheet
            ref={grantsSheet}
            companyId={activeCompanyId}
            member={grantsMember}
          />
        </>
      ) : null}

      <ConfirmDialog
        visible={booting !== null}
        title={t("companies.admin.manage.attached.bootConfirm", {
          name: booting ? memberDisplayName(booting) : "",
        })}
        confirmLabel={t("companies.admin.manage.attached.boot")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={boot.isPending}
        onCancel={() => setBooting(null)}
        onConfirm={() =>
          booting &&
          activeCompanyId &&
          boot.mutate(
            { companyId: activeCompanyId, userId: booting.user_id },
            { onSettled: () => setBooting(null) },
          )
        }
      />
    </View>
  );
}
