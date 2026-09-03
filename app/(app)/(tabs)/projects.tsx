import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, View } from "react-native";

import { EmptyState, ErrorState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useProjects } from "@/features/projects/projects-api";

export default function ProjectsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const projects = useProjects();

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("tabs.projects")} />
      {projects.isPending ? (
        <ActivityIndicator className="mt-8" />
      ) : projects.isError ? (
        <ErrorState
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => projects.refetch()}
        />
      ) : (
        <FlatList
          testID="projects-list"
          data={projects.data.projects}
          keyExtractor={(item) => item.id}
          contentContainerClassName="flex-grow p-4"
          refreshing={projects.isRefetching}
          onRefresh={() => projects.refetch()}
          ListEmptyComponent={<EmptyState message={t("home.noProjects")} />}
          renderItem={({ item }) => (
            <ListRow
              testID={`project-row-${item.id}`}
              title={item.name}
              subtitle={item.address ?? null}
              onPress={() => router.push(`/projects/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
