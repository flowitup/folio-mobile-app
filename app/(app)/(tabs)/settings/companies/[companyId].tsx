import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
} from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { ToastViewport } from "@/components/ui/toast";
import {
  useAttachedUsers,
  useBootAttachedUser,
  useCompany,
  useDeleteCompany,
  useGenerateInviteToken,
  useRevokeInviteToken,
  useSetMemberRole,
  useUpdateCompany,
} from "@/features/companies/companies-api";
import type {
  AttachedUser,
  CompanyInviteTokenGenerated,
  CompanyRole,
} from "@/features/companies/companies-api";
import { CompanyFormSheet } from "@/features/companies/company-form-sheet";
import { PaymentMethodsSection } from "@/features/companies/payment-methods-section";
import { formatDate } from "@/lib/format/date";
import { ApiError } from "@/lib/query/api-error";

type Tab = "edit" | "invites" | "users" | "payments" | "delete";
const TABS: Tab[] = ["edit", "invites", "users", "payments", "delete"];

/** Company manage page: edit, invite tokens (one-shot display), attached users, payment methods, delete. */
export default function CompanyManageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  const company = useCompany(companyId);
  const users = useAttachedUsers(companyId);
  const update = useUpdateCompany();
  const remove = useDeleteCompany();
  const generate = useGenerateInviteToken();
  const revoke = useRevokeInviteToken();
  const setRole = useSetMemberRole();
  const boot = useBootAttachedUser();
  const [tab, setTab] = useState<Tab>("edit");
  const editSheet = useRef<BottomSheetModal>(null);
  const [inviteRole, setInviteRole] = useState<CompanyRole>("member");
  const [generated, setGenerated] =
    useState<CompanyInviteTokenGenerated | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    run: () => void;
  } | null>(null);
  const [booting, setBooting] = useState<AttachedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  function generateToken(regenerate = false) {
    if (!companyId) return;
    generate.mutate(
      { companyId, role: inviteRole, regenerate },
      {
        onSuccess: setGenerated,
        onError: (error) => {
          // Same fallback as the web: an active token already exists → ask before regenerating.
          if (error instanceof ApiError && error.status === 409 && !regenerate)
            setConfirm({
              title: t("companies.admin.manage.invites.regenerateConfirm"),
              run: () => generateToken(true),
            });
        },
      },
    );
  }

  if (company.isPending)
    return (
      <View className="flex-1 bg-card">
        <ScreenHeader title="…" back />
        <ActivityIndicator className="mt-8" />
      </View>
    );
  if (!company.data)
    return (
      <View className="flex-1 bg-card">
        <ScreenHeader title={t("companies.admin.manage.title")} back />
        <ErrorState
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void company.refetch()}
        />
      </View>
    );
  const data = company.data;

  return (
    <View className="flex-1 bg-card">
      <ScreenHeader title={data.legal_name} back />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-11 border-b border-border"
      >
        {TABS.map((value) => (
          <Pressable
            key={value}
            testID={`company-tab-${value}`}
            onPress={() => setTab(value)}
            className={`justify-center border-b-2 px-3 ${tab === value ? "border-primary" : "border-transparent"}`}
          >
            <Text
              className={
                tab === value
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
            >
              {t(`companies.admin.manage.tabs.${value}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {tab === "edit" ? (
          <Card>
            <Text className="text-base font-semibold text-primary">
              {data.legal_name}
            </Text>
            <Text className="text-sm text-primary">{data.address}</Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              SIRET {data.siret ?? "—"} · TVA {data.tva_number ?? "—"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              IBAN {data.iban ?? "—"} · BIC {data.bic ?? "—"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {t("companies.form.fields.prefixOverride.label")}:{" "}
              {data.prefix_override ?? "—"} ·{" "}
              {t("companies.form.fields.defaultPaymentTerms.label")}:{" "}
              {data.default_payment_terms ?? "—"}
            </Text>
            <Button
              testID="company-edit"
              label={t("companies.admin.manage.edit.save")}
              className="mt-3"
              onPress={() => editSheet.current?.present()}
            />
          </Card>
        ) : null}

        {tab === "invites" ? (
          <View>
            <Text className="mb-3 text-xs text-muted-foreground">
              {t("companies.admin.manage.invites.description")}
            </Text>
            <Select<CompanyRole>
              testID="invite-role"
              label={t("companies.admin.manage.invites.roleLabel")}
              value={inviteRole}
              options={[
                {
                  value: "member",
                  label: t("companies.admin.manage.invites.roleMemberOption"),
                },
                {
                  value: "admin",
                  label: t("companies.admin.manage.invites.roleAdminOption"),
                },
              ]}
              onChange={setInviteRole}
            />
            <View className="flex-row flex-wrap gap-2">
              <Button
                testID="invite-generate"
                label={t("companies.admin.manage.invites.generate")}
                loading={generate.isPending}
                onPress={() => generateToken(false)}
              />
              <Button
                testID="invite-regenerate"
                label={t("companies.admin.manage.invites.regenerate")}
                variant="secondary"
                onPress={() =>
                  setConfirm({
                    title: t(
                      "companies.admin.manage.invites.regenerateConfirm",
                    ),
                    run: () => generateToken(true),
                  })
                }
              />
              <Button
                testID="invite-revoke"
                label={t("companies.admin.manage.invites.revoke")}
                variant="danger"
                loading={revoke.isPending}
                onPress={() =>
                  setConfirm({
                    title: t("companies.admin.manage.invites.revokeConfirm"),
                    run: () => companyId && revoke.mutate({ companyId }),
                  })
                }
              />
            </View>
            <Text className="mt-3 text-xs text-muted-foreground">
              {t("companies.admin.manage.invites.policyNote")}
            </Text>
          </View>
        ) : null}

        {tab === "users" ? (
          <View>
            {users.isPending ? <ActivityIndicator /> : null}
            {users.data && users.data.length === 0 ? (
              <EmptyState
                message={t("companies.admin.manage.attached.empty")}
              />
            ) : null}
            {(users.data ?? []).map((member) => (
              <Card key={member.user_id} className="mb-2">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="flex-1 pr-2 text-base text-primary"
                    numberOfLines={1}
                  >
                    {member.display_name ?? member.email ?? member.user_id}
                  </Text>
                  <Badge
                    label={t(
                      `companies.admin.manage.attached.role${member.role === "admin" ? "Admin" : "Member"}`,
                    )}
                    tone={member.role === "admin" ? "success" : "neutral"}
                  />
                </View>
                <Text className="text-xs text-muted-foreground">
                  {member.email} ·{" "}
                  {t("companies.admin.manage.attached.attachedAt")}{" "}
                  {formatDate(member.attached_at)}
                  {member.is_primary
                    ? ` · ${t("companies.admin.manage.attached.primaryBadge")}`
                    : ""}
                </Text>
                <View className="mt-2 flex-row gap-2">
                  <Button
                    testID={`member-role-${member.user_id}`}
                    label={t(
                      member.role === "admin"
                        ? "companies.admin.manage.attached.makeMember"
                        : "companies.admin.manage.attached.makeAdmin",
                    )}
                    size="sm"
                    variant="secondary"
                    loading={setRole.isPending}
                    onPress={() =>
                      companyId &&
                      setRole.mutate({
                        companyId,
                        userId: member.user_id,
                        role: member.role === "admin" ? "member" : "admin",
                      })
                    }
                  />
                  <Button
                    testID={`member-boot-${member.user_id}`}
                    label={t("companies.admin.manage.attached.boot")}
                    size="sm"
                    variant="danger"
                    onPress={() => setBooting(member)}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {tab === "payments" && companyId ? (
          <PaymentMethodsSection companyId={companyId} />
        ) : null}

        {tab === "delete" ? (
          <Card>
            <Text className="text-base font-semibold text-danger">
              {t("companies.admin.manage.delete.title")}
            </Text>
            <Text className="my-2 text-sm text-primary">
              {t("companies.admin.manage.delete.body")}
            </Text>
            <Button
              testID="company-delete"
              label={t("companies.admin.manage.delete.confirm")}
              variant="danger"
              onPress={() => setDeleting(true)}
            />
          </Card>
        ) : null}
      </ScrollView>

      <CompanyFormSheet
        key={data.updated_at}
        ref={editSheet}
        initial={data}
        submitting={update.isPending}
        onSubmit={(payload) =>
          update.mutate(
            { id: data.id, ...payload },
            { onSuccess: () => editSheet.current?.dismiss() },
          )
        }
      />

      <Modal
        visible={generated !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setGenerated(null)}
      >
        <View className="flex-1 items-center justify-center bg-scrim p-6">
          <View className="w-full rounded-lg bg-card p-4">
            <Text className="mb-2 text-lg font-semibold text-primary">
              {t("companies.tokenGenerated.dialogTitle")}
            </Text>
            <Text
              testID="invite-token-value"
              selectable
              className="mb-2 rounded bg-muted p-2 font-mono text-xs text-primary"
            >
              {generated?.token}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {t("companies.tokenGenerated.expiresLine", {
                expiresAt: generated ? formatDate(generated.expires_at) : "",
              })}
            </Text>
            <Text className="my-2 text-xs text-warning">
              {t("companies.tokenGenerated.oneShotWarning")}
            </Text>
            <View className="flex-row justify-end gap-2">
              <Button
                testID="invite-token-share"
                label={t("companies.x.tokenShare")}
                size="sm"
                variant="secondary"
                onPress={() =>
                  generated && void Share.share({ message: generated.token })
                }
              />
              <Button
                label={t("common.ok")}
                size="sm"
                onPress={() => setGenerated(null)}
              />
            </View>
          </View>
          <ToastViewport />
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirm !== null}
        title={confirm?.title ?? ""}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.run();
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        visible={booting !== null}
        title={t("companies.admin.manage.attached.bootConfirm", {
          name: booting?.display_name ?? booting?.email ?? "",
        })}
        confirmLabel={t("companies.admin.manage.attached.boot")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={boot.isPending}
        onCancel={() => setBooting(null)}
        onConfirm={() =>
          booting &&
          companyId &&
          boot.mutate(
            { companyId, userId: booting.user_id },
            { onSettled: () => setBooting(null) },
          )
        }
      />
      <ConfirmDialog
        visible={deleting}
        title={t("companies.x.deleteConfirm", { name: data.legal_name })}
        confirmLabel={t("companies.admin.manage.delete.confirm")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          remove.mutate(
            { id: data.id },
            {
              onSuccess: () => {
                setDeleting(false);
                router.back();
              },
              onError: () => setDeleting(false),
            },
          )
        }
      />
    </View>
  );
}
