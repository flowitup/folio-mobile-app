import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Eyebrow } from "@/components/ui/typography";
import type { AttachedUser } from "@/features/companies/company-members-api";
import {
  useMemberGrants,
  useRemoveMemberGrant,
  useSetMemberGrant,
} from "@/features/companies/member-grants-api";
import type {
  GrantEffect,
  MemberGrantRow,
} from "@/features/companies/member-grants-api";
import { useProjects } from "@/features/projects/projects-api";
import { memberDisplayName } from "@/lib/companies/member-display";

const COMPANY_WIDE = "__company_wide__";

type Props = { companyId: string; member: AttachedUser | null };

/**
 * D8 per-member custom scope: grant or deny one whitelisted permission, company-wide or scoped
 * to a single project of the company. Admins are not customisable (the backend 400s it), so the
 * parent only opens this for manager/member rows.
 */

/** i18next treats ":" as the namespace separator, so permission keys are stored with "_". */
function permissionLabelKey(permission: string): string {
  return permission.replace(/:/g, "_");
}

export const MemberGrantsSheet = forwardRef<BottomSheetModal, Props>(
  function MemberGrantsSheet({ companyId, member }, ref) {
    const { t } = useTranslation();
    const userId = member?.user_id;
    const grants = useMemberGrants(companyId, userId);
    const setGrant = useSetMemberGrant();
    const removeGrant = useRemoveMemberGrant();
    const projects = useProjects();
    const companyProjects = useMemo(
      () =>
        (projects.data?.projects ?? []).filter(
          (project) => project.company_id === companyId,
        ),
      [projects.data, companyId],
    );

    const [permission, setPermission] = useState<string | null>(null);
    const [effect, setEffect] = useState<GrantEffect>("grant");
    const [scope, setScope] = useState<string>(COMPANY_WIDE);
    const [removingRow, setRemovingRow] = useState<MemberGrantRow | null>(null);

    useEffect(() => {
      setPermission(null);
      setEffect("grant");
      setScope(COMPANY_WIDE);
    }, [userId]);

    const customisable = grants.data?.customisable ?? [];
    const rows = grants.data?.grants ?? [];

    function submit() {
      if (!userId || !permission) return;
      setGrant.mutate({
        companyId,
        userId,
        permission,
        effect,
        project_id: scope === COMPANY_WIDE ? null : scope,
      });
    }

    return (
      <>
        <Sheet
          ref={ref}
          title={t("companies.members.grants.title", {
            name: member ? memberDisplayName(member) : "",
          })}
          snapPoints={["85%"]}
        >
          <ScrollView className="p-4">
            {grants.isPending ? <ActivityIndicator className="my-4" /> : null}
            {grants.isFetched && rows.length === 0 ? (
              <EmptyState message={t("companies.members.grants.none")} />
            ) : null}
            {rows.map((row) => {
              const project = companyProjects.find(
                (p) => p.id === row.project_id,
              );
              return (
                <View
                  key={`${row.permission}-${row.project_id ?? "company"}`}
                  testID={`grant-row-${row.permission}-${row.project_id ?? "company"}`}
                  className="mb-2 flex-row items-center justify-between rounded-[10px] border border-line-2 bg-card px-3.5 py-3"
                >
                  <View className="min-w-0 flex-1 pr-2">
                    <Text
                      className="font-sans-medium text-[13px] text-ink"
                      numberOfLines={1}
                    >
                      {t(`permissions.${permissionLabelKey(row.permission)}`, {
                        defaultValue: row.permission,
                      })}
                    </Text>
                    <Text className="font-sans text-[11.5px] text-muted">
                      {/* "Company-wide" only when the row is actually unscoped (project_id ===
                        null) — a scoped row whose project failed to resolve (not loaded, not
                        visible to this caller) must say so, not silently read as company-wide. */}
                      {row.project_id === null
                        ? t("companies.members.grants.companyWide")
                        : (project?.name ??
                          t("companies.members.grants.projectUnknown"))}
                    </Text>
                  </View>
                  <Badge
                    label={t(`companies.members.grants.effect.${row.effect}`)}
                    tone={row.effect === "grant" ? "success" : "danger"}
                  />
                  <Pressable
                    testID={`grant-remove-${row.permission}-${row.project_id ?? "company"}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    className="ml-3"
                    onPress={() => setRemovingRow(row)}
                  >
                    <Text className="font-sans text-xs text-negative">
                      {t("common.remove")}
                    </Text>
                  </Pressable>
                </View>
              );
            })}

            {/*
            The permission/scope pickers below are always mounted, even while `customisable` is
            still loading (empty options meanwhile). Gating them behind the async query result
            used to mount their nested `Select` sheets only after this sheet was already
            presented, which corrupts @gorhom/bottom-sheet's push-stack bookkeeping: selecting an
            option dismissed both sheets and left the parent's `present()` ref unusable until an
            app restart (upstream: gorhom/react-native-bottom-sheet#1561). Every other screen that
            nests a `Select` in a `Sheet` (task/product forms) mounts its pickers unconditionally
            for the same reason — keep this one consistent with that pattern.
          */}
            <Eyebrow className="mb-2 mt-4">
              {t("companies.members.grants.addTitle")}
            </Eyebrow>
            <Select
              testID="grant-permission"
              label={t("companies.members.grants.permissionLabel")}
              placeholder={t("companies.members.grants.permissionPlaceholder")}
              value={permission}
              options={customisable.map((p) => ({
                value: p,
                label: t(`permissions.${permissionLabelKey(p)}`, {
                  defaultValue: p,
                }),
                description: p,
              }))}
              onChange={setPermission}
            />
            <View className="mb-4">
              <Eyebrow className="mb-1.5">
                {t("companies.members.grants.effectLabel")}
              </Eyebrow>
              <Segmented<GrantEffect>
                testID="grant-effect"
                value={effect}
                onChange={setEffect}
                options={[
                  {
                    value: "grant",
                    label: t("companies.members.grants.effect.grant"),
                  },
                  {
                    value: "deny",
                    label: t("companies.members.grants.effect.deny"),
                  },
                ]}
              />
            </View>
            <Select
              testID="grant-scope"
              label={t("companies.members.grants.scopeLabel")}
              value={scope}
              options={[
                {
                  value: COMPANY_WIDE,
                  label: t("companies.members.grants.companyWide"),
                },
                ...companyProjects.map((project) => ({
                  value: project.id,
                  label: project.name,
                })),
              ]}
              onChange={setScope}
            />
            <Button
              testID="grant-submit"
              label={t("common.save")}
              loading={setGrant.isPending}
              disabled={!permission}
              onPress={submit}
            />
          </ScrollView>
        </Sheet>

        <ConfirmDialog
          visible={removingRow !== null}
          title={t("companies.members.grants.removeConfirm", {
            permission: removingRow
              ? t(`permissions.${permissionLabelKey(removingRow.permission)}`, {
                  defaultValue: removingRow.permission,
                })
              : "",
          })}
          confirmLabel={t("common.remove")}
          cancelLabel={t("common.cancel")}
          destructive
          loading={removeGrant.isPending}
          onCancel={() => setRemovingRow(null)}
          onConfirm={() =>
            userId &&
            removingRow &&
            removeGrant.mutate(
              {
                companyId,
                userId,
                permission: removingRow.permission,
                project_id: removingRow.project_id,
              },
              { onSettled: () => setRemovingRow(null) },
            )
          }
        />
      </>
    );
  },
);
