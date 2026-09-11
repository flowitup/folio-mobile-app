import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { isPlatformOps } from "@/auth/permissions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  useCreateCompany,
  useDetachCompany,
  useMyCompanies,
  useSetPrimaryCompany,
} from "@/features/companies/companies-api";
import type { MyCompany } from "@/features/companies/companies-api";
import { CompanyFormSheet } from "@/features/companies/company-form-sheet";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** My companies: cards with masked sensitive fields, set primary, detach, manage (admins), create. */
export default function MyCompaniesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const superadmin = isPlatformOps(user);
  const companies = useMyCompanies();
  useRefetchOnFocus(companies.refetch);
  const setPrimary = useSetPrimaryCompany();
  const detach = useDetachCompany();
  const create = useCreateCompany();
  const createSheet = useRef<BottomSheetModal>(null);
  const [createKey, setCreateKey] = useState(0);
  const [detaching, setDetaching] = useState<MyCompany | null>(null);

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader
        title={t("companies.my.title")}
        back
        right={
          superadmin ? (
            <Button
              testID="company-create"
              label={`＋ ${t("companies.x.create")}`}
              size="sm"
              onPress={() => createSheet.current?.present()}
            />
          ) : null
        }
      />
      <ScrollView contentContainerClassName="p-4 pb-12">
        <Text className="mb-3 text-xs text-muted-foreground">
          {t("companies.my.description")}
        </Text>
        {companies.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {companies.data && companies.data.length === 0 ? (
          <EmptyState message={t("companies.my.empty.cta")} />
        ) : null}
        {(companies.data ?? []).map((company) => (
          <Card key={company.id} className="mb-3">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 pr-2 text-base font-semibold text-primary">
                {company.legal_name}
              </Text>
              {company.is_primary ? (
                <Badge
                  label={t("companies.my.card.primaryBadge")}
                  tone="success"
                />
              ) : null}
            </View>
            <Text className="text-xs text-muted-foreground" numberOfLines={2}>
              {company.address}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              SIRET {company.siret ?? "—"} · TVA {company.tva_number ?? "—"} ·
              IBAN {company.iban ?? "—"} · BIC {company.bic ?? "—"}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              {t("settings.role", { role: t(`companies.x.${company.role}`) })}
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              <Button
                testID={`company-primary-${company.id}`}
                label={t("companies.my.card.setPrimary")}
                size="sm"
                variant="secondary"
                disabled={company.is_primary}
                onPress={() => setPrimary.mutate({ id: company.id })}
              />
              {superadmin || company.role === "admin" ? (
                <Button
                  testID={`company-manage-${company.id}`}
                  label={t("companies.x.manage")}
                  size="sm"
                  onPress={() =>
                    router.push(`/settings/companies/${company.id}`)
                  }
                />
              ) : null}
              <Button
                testID={`company-detach-${company.id}`}
                label={t("companies.my.card.detach")}
                size="sm"
                variant="danger"
                onPress={() => setDetaching(company)}
              />
            </View>
          </Card>
        ))}
      </ScrollView>

      <CompanyFormSheet
        key={createKey}
        ref={createSheet}
        submitting={create.isPending}
        onSubmit={(payload) =>
          create.mutate(payload, {
            onSuccess: () => {
              createSheet.current?.dismiss();
              setCreateKey((k) => k + 1);
            },
          })
        }
      />

      <ConfirmDialog
        visible={detaching !== null}
        title={t("companies.my.card.detachConfirm", {
          name: detaching?.legal_name ?? "",
        })}
        confirmLabel={t("companies.my.card.detach")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={detach.isPending}
        onCancel={() => setDetaching(null)}
        onConfirm={() =>
          detaching &&
          detach.mutate(
            { id: detaching.id },
            { onSettled: () => setDetaching(null) },
          )
        }
      />
    </View>
  );
}
