import { useTranslation } from "react-i18next";
import { Pressable, Share, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import type { Company, CompanyRole } from "@/features/companies/companies-api";
import {
  useRevokeJoinCode,
  useSetJoinCode,
} from "@/features/companies/companies-api";
import type {
  AttachedUser,
  CompanyPersonEntry,
} from "@/features/companies/company-members-api";
import { formatJoinCode } from "@/lib/companies/join-code";
import {
  memberDisplayName,
  memberSecondaryLabel,
} from "@/lib/companies/member-display";
import { formatDate } from "@/lib/format/date";

const ROLE_OPTIONS: CompanyRole[] = ["admin", "manager", "member"];

/** Join code card (D1): show/regenerate/revoke, admins only (see `company/members.tsx`). */
export function JoinCodeCard({
  companyId,
  company,
}: {
  companyId: string;
  company: Company | undefined;
}) {
  const { t } = useTranslation();
  const setJoinCode = useSetJoinCode();
  const revokeJoinCode = useRevokeJoinCode();

  return (
    <Card className="mb-4" testID="join-code-card">
      <Text className="font-sans-semibold text-[14px] text-ink">
        {t("companies.admin.manage.joinCode.title")}
      </Text>
      <Text className="mb-3 mt-1 font-sans text-[12px] text-muted">
        {t("companies.admin.manage.joinCode.description")}
      </Text>
      {company?.join_code ? (
        <Pressable
          testID="join-code-share"
          accessibilityRole="button"
          onPress={() =>
            void Share.share({
              message: t("companies.admin.manage.joinCode.shareMessage", {
                company: company.legal_name,
                code: formatJoinCode(company.join_code ?? ""),
              }),
            })
          }
          className="mb-3 items-center rounded-[10px] border border-line-2 bg-paper-2 py-3 active:opacity-70"
        >
          <Text
            testID="join-code-value"
            className="font-mono-bold text-[24px] tracking-[3px] text-ink"
          >
            {formatJoinCode(company.join_code)}
          </Text>
          <Text className="mt-1 font-sans text-[11px] text-muted">
            {t("companies.admin.manage.joinCode.tapToShare")}
          </Text>
        </Pressable>
      ) : (
        <Text className="mb-3 font-sans text-[13px] text-muted">
          {t("companies.admin.manage.joinCode.none")}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        <Button
          testID="join-code-create"
          label={
            company?.join_code
              ? t("companies.admin.manage.joinCode.renew")
              : t("companies.admin.manage.joinCode.create")
          }
          size="sm"
          loading={setJoinCode.isPending}
          onPress={() => setJoinCode.mutate({ companyId })}
        />
        {company?.join_code ? (
          <Button
            testID="join-code-revoke"
            label={t("companies.admin.manage.joinCode.revoke")}
            size="sm"
            variant="danger"
            loading={revokeJoinCode.isPending}
            onPress={() => revokeJoinCode.mutate({ companyId })}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** One attached-user row: role select, D8 "Quyền tuỳ chỉnh" entry, boot — hidden for the caller. */
export function MemberRow({
  member,
  isSelf,
  onChangeRole,
  onOpenGrants,
  onBoot,
}: {
  member: AttachedUser;
  isSelf: boolean;
  onChangeRole: (role: CompanyRole) => void;
  onOpenGrants: () => void;
  onBoot: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="mb-2" testID={`member-${member.user_id}`}>
      <View className="flex-row items-center justify-between">
        <Text
          className="flex-1 pr-2 font-sans-medium text-[14px] text-ink"
          numberOfLines={1}
        >
          {memberDisplayName(member)}
        </Text>
        <Badge
          label={t(`companies.x.${member.role}`)}
          tone={member.role === "admin" ? "success" : "neutral"}
        />
      </View>
      <Text className="mt-0.5 font-sans text-[11.5px] text-muted">
        {memberSecondaryLabel(member)} ·{" "}
        {t("companies.admin.manage.attached.attachedAt")}{" "}
        {formatDate(member.attached_at)}
        {member.is_primary
          ? ` · ${t("companies.admin.manage.attached.primaryBadge")}`
          : ""}
      </Text>
      {isSelf ? null : (
        <View className="mt-2.5 gap-2">
          <Select<CompanyRole>
            testID={`member-role-${member.user_id}`}
            value={member.role}
            options={ROLE_OPTIONS.map((role) => ({
              value: role,
              label: t(`companies.x.${role}`),
            }))}
            onChange={(role) => role !== member.role && onChangeRole(role)}
          />
          <View className="flex-row gap-2">
            {member.role !== "admin" ? (
              <Button
                testID={`member-grants-${member.user_id}`}
                label={t("companies.members.grants.open")}
                size="sm"
                variant="secondary"
                onPress={onOpenGrants}
              />
            ) : null}
            <Button
              testID={`member-boot-${member.user_id}`}
              label={t("companies.admin.manage.attached.boot")}
              size="sm"
              variant="danger"
              onPress={onBoot}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

/**
 * A person added by phone but not yet linked to an account (`pending`, no `linked_user_id`) —
 * the only feedback confirming "add by phone" worked before the person signs up and attaches.
 */
export function PendingPersonRow({ person }: { person: CompanyPersonEntry }) {
  const { t } = useTranslation();

  return (
    <Card className="mb-2" testID={`pending-person-${person.person_id}`}>
      <View className="flex-row items-center justify-between">
        <Text
          className="flex-1 pr-2 font-sans-medium text-[14px] text-ink"
          numberOfLines={1}
        >
          {person.name}
        </Text>
        <Badge label={t("companies.members.pending.badge")} tone="neutral" />
      </View>
      {person.phone ? (
        <Text className="mt-0.5 font-sans text-[11.5px] text-muted">
          {person.phone}
        </Text>
      ) : null}
    </Card>
  );
}
