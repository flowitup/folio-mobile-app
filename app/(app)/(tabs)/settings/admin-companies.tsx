import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { EmptyState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  useAllCompanies,
  useCreateCompany,
} from "@/features/companies/companies-api";
import { CompanyFormSheet } from "@/features/companies/company-form-sheet";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Superadmin roster of every company (full sensitive values) with create and manage. */
export default function AdminCompaniesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const superadmin = user?.permissions.includes("*:*") ?? false;
  const companies = useAllCompanies(superadmin);
  useRefetchOnFocus(companies.refetch);
  const create = useCreateCompany();
  const sheet = useRef<BottomSheetModal>(null);
  const [key, setKey] = useState(0);

  return (
    <View className="flex-1 bg-card">
      <ScreenHeader
        title={t("companies.admin.title")}
        back
        right={
          superadmin ? (
            <Button
              testID="admin-company-create"
              label={`＋ ${t("companies.admin.newCompany")}`}
              size="sm"
              onPress={() => sheet.current?.present()}
            />
          ) : null
        }
      />
      <ScrollView contentContainerClassName="p-4 pb-12">
        {!superadmin ? (
          <EmptyState message={t("companies.errors.forbiddenAdminRequired")} />
        ) : null}
        <Text className="mb-3 text-xs text-muted-foreground">
          {t("companies.admin.description")}
        </Text>
        {companies.isPending && superadmin ? (
          <ActivityIndicator className="mt-8" />
        ) : null}
        {companies.data && companies.data.length === 0 ? (
          <EmptyState message={t("companies.admin.empty.title")} />
        ) : null}
        {(companies.data ?? []).map((company) => (
          <ListRow
            key={company.id}
            testID={`admin-company-${company.id}`}
            title={company.legal_name}
            subtitle={`${company.siret ?? "—"} · ${company.tva_number ?? "—"} · ${t("companies.admin.table.createdAt")} ${formatDate(company.created_at)}`}
            right={
              <Text className="text-sm text-primary">
                {t("companies.x.manage")}
              </Text>
            }
            onPress={() => router.push(`/settings/companies/${company.id}`)}
          />
        ))}
      </ScrollView>
      <CompanyFormSheet
        key={key}
        ref={sheet}
        submitting={create.isPending}
        onSubmit={(payload) =>
          create.mutate(payload, {
            onSuccess: () => {
              sheet.current?.dismiss();
              setKey((k) => k + 1);
            },
          })
        }
      />
    </View>
  );
}
