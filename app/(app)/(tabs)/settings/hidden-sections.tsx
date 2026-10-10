import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

import { Card, EmptyState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  useMyCompanies,
  useUpdateCompany,
} from "@/features/companies/companies-api";
import {
  HIDEABLE_SECTIONS,
  hideableSectionLabelKey,
  useCanManageHiddenSections,
} from "@/features/companies/hidden-sections";
import { useTokens } from "@/theme/tokens";

/**
 * Settings → Hidden sections: one switch per Menu area / project section, saved on the company
 * (every member of it stops seeing a switched-off section). A switch moves at once and snaps back
 * if the save fails — `useApiMutation` toasts the error.
 */
export default function HiddenSectionsScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const companies = useMyCompanies();
  const company = companies.data?.[0];
  const canManage = useCanManageHiddenSections();
  const update = useUpdateCompany();
  // Optimistic view while a save is in flight; cleared on settle so the cache wins again.
  const [optimistic, setOptimistic] = useState<string[] | null>(null);
  const hidden = optimistic ?? company?.hidden_sections ?? [];

  const toggle = (section: string, visible: boolean) => {
    if (!company) return;
    const next = visible
      ? hidden.filter((key) => key !== section)
      : [...hidden.filter((key) => key !== section), section];
    setOptimistic(next);
    update.mutate(
      { id: company.id, hidden_sections: next },
      { onSettled: () => setOptimistic(null) },
    );
  };

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("settings.hiddenSections.title")} back />
      <ScrollView
        contentContainerClassName="px-4 pb-6 pt-3.5"
        contentContainerStyle={{ gap: 12 }}
      >
        {companies.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {!companies.isPending && (!company || !canManage) ? (
          <EmptyState message={t("settings.hiddenSections.adminOnly")} />
        ) : null}
        {company && canManage ? (
          <>
            <Text className="font-sans text-[13px] text-muted">
              {t("settings.hiddenSections.intro", {
                company: company.legal_name,
              })}
            </Text>
            <Card
              padded={false}
              className="overflow-hidden"
              testID="hidden-sections"
            >
              {HIDEABLE_SECTIONS.map((section) => (
                <ListRow
                  key={section}
                  grouped
                  title={t(hideableSectionLabelKey(section))}
                  right={
                    <Switch
                      testID={`hidden-section-${section}`}
                      value={!hidden.includes(section)}
                      disabled={update.isPending}
                      onValueChange={(visible) => toggle(section, visible)}
                      trackColor={{ true: tokens.accent, false: tokens.line }}
                      accessibilityLabel={t(hideableSectionLabelKey(section))}
                    />
                  }
                />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
