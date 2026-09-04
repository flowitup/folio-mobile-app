import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useMyCompanies } from "@/features/companies/companies-api";
import { usePaymentMethods } from "@/features/invoices/invoices-api";
import { useLaborRoles } from "@/features/labor/labor-api";

/** Cài đặt hub: list card with a value column (company name, counts) and chevrons; outline sign-out. */
export default function SettingsHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const superadmin = user?.permissions.includes("*:*") ?? false;
  const companies = useMyCompanies();
  const primary = companies.data?.[0];
  const paymentMethods = usePaymentMethods(primary?.id);
  const roles = useLaborRoles();

  const rows: { key: string; label: string; value?: string; path: string }[] = [
    {
      key: "companies",
      label: t("settings.myCompanies"),
      value: primary?.legal_name,
      path: "/settings/companies",
    },
    {
      key: "payment-methods",
      label: t("settings.paymentMethods"),
      value: paymentMethods.data
        ? String(paymentMethods.data.length)
        : undefined,
      path: "/settings/payment-methods",
    },
    {
      key: "labor-roles",
      label: t("settings.laborRoles"),
      value: roles.data ? String(roles.data.roles.length) : undefined,
      path: "/settings/labor-roles",
    },
    {
      key: "persons-merge",
      label: t("settings.personsMerge"),
      path: "/settings/persons-merge",
    },
    ...(superadmin
      ? [
          {
            key: "admin-companies",
            label: t("settings.adminCompanies"),
            path: "/settings/admin-companies",
          },
          {
            key: "users",
            label: t("settings.usersAdmin"),
            path: "/settings/users",
          },
        ]
      : []),
  ];

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("settings.title")} back />
      <ScrollView
        contentContainerClassName="px-4 pb-6 pt-3.5"
        contentContainerStyle={{ gap: 16 }}
      >
        <Card padded={false} className="overflow-hidden" testID="settings-list">
          {rows.map((row) => (
            <ListRow
              key={row.key}
              testID={`settings-${row.key}`}
              title={row.label}
              value={row.value}
              grouped
              chevron
              onPress={() => router.push(row.path)}
            />
          ))}
        </Card>
        <Button
          label={t("home.signOut")}
          variant="danger"
          onPress={() => void signOut()}
          testID="home-sign-out"
        />
      </ScrollView>
    </View>
  );
}
