import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text } from "react-native";

import { CoverPhotosStrip } from "@/components/project/cover-photos-strip";
import { ProjectSummaryCard } from "@/components/project/project-summary-card";
import { useProject } from "@/features/projects/projects-api";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

export default function ProjectOverviewSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  useRefetchOnFocus(project.refetch);

  if (!id)
    return <Text className="p-4 text-danger">{t("home.loadError")}</Text>;
  if (project.isPending) return <ActivityIndicator className="mt-8" />;
  if (project.isError || !project.data)
    return <Text className="p-4 text-danger">{t("home.loadError")}</Text>;

  return (
    <ScrollView className="flex-1 bg-card" contentContainerClassName="p-4">
      <ProjectSummaryCard project={project.data} />
      <CoverPhotosStrip projectId={id} />
    </ScrollView>
  );
}
