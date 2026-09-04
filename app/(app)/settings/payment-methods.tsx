import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { useMyCompanies } from "@/features/companies/companies-api";
import { PaymentMethodsSection } from "@/features/companies/payment-methods-section";

/** Payment methods per attached company (primary by default); management needs superadmin or company admin. */
export default function PaymentMethodsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const companies = useMyCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const selected =
    (companies.data ?? []).find((c) => c.id === companyId) ??
    companies.data?.[0];
  const canManage =
    (user?.permissions.includes("*:*") ?? false) || selected?.role === "admin";

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("paymentMethods.title")} back />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {companies.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {companies.data && companies.data.length === 0 ? (
          <EmptyState message={t("paymentMethods.noCompanies")} />
        ) : null}
        {(companies.data?.length ?? 0) > 1 ? (
          <Select
            testID="pm-company"
            label={t("paymentMethods.companyLabel")}
            value={selected?.id ?? null}
            options={(companies.data ?? []).map((c) => ({
              value: c.id,
              label: c.legal_name,
            }))}
            onChange={setCompanyId}
          />
        ) : null}
        {selected ? (
          <PaymentMethodsSection
            key={selected.id}
            companyId={selected.id}
            readOnly={!canManage}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
