import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { ScreenHeader } from "@/components/ui/screen-header";
import { BillingTemplateForm } from "@/features/billing/billing-template-form";
import { useCreateBillingTemplate } from "@/features/billing/billing-templates-api";

export default function NewBillingTemplateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const create = useCreateBillingTemplate();
  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("billing.templates.new")} back />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        <BillingTemplateForm
          defaultKind={kind === "facture" ? "facture" : "devis"}
          submitting={create.isPending}
          onSubmit={(payload) =>
            create.mutate(payload, { onSuccess: () => router.back() })
          }
        />
      </ScrollView>
    </View>
  );
}
