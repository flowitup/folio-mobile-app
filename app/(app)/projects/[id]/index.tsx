import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text } from "react-native";

import { Card } from "@/components/ui/primitives";
import { useProject } from "@/features/projects/projects-api";
import { formatMoney } from "@/lib/format/money";

// Overview section: read-only summary until the projects phase adds editing.
export default function ProjectOverviewSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);

  if (!id)
    return <Text className="p-4 text-danger">{t("home.loadError")}</Text>;
  if (project.isPending) return <ActivityIndicator className="mt-8" />;
  if (project.isError || !project.data)
    return <Text className="p-4 text-danger">{t("home.loadError")}</Text>;

  const { name, address, budget, spent } = project.data;
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-4">
      <Card>
        <Text
          className="text-lg font-semibold text-primary"
          testID="project-overview-name"
        >
          {name}
        </Text>
        {address ? (
          <Text className="mt-1 text-sm text-muted-foreground">{address}</Text>
        ) : null}
        {spent != null ? (
          <Text className="mt-2 text-base text-primary">
            {t("project.spent")}: {formatMoney(spent)}
          </Text>
        ) : null}
        {budget != null ? (
          <Text className="mt-2 text-base text-primary">
            {t("project.budget")}: {formatMoney(budget)}
          </Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}
