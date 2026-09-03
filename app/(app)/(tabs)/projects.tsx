import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/auth/auth-context";
import { EmptyState, ErrorState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ProjectFormSheet } from "@/features/projects/project-form-sheet";
import type { ProjectFormSheetHandle } from "@/features/projects/project-form-sheet";
import {
  projectCan,
  useCreateProject,
  useProjects,
} from "@/features/projects/projects-api";
import { formatMoney } from "@/lib/format/money";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

export default function ProjectsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const projects = useProjects();
  const createProject = useCreateProject();
  const form = useRef<ProjectFormSheetHandle>(null);
  const [search, setSearch] = useState("");
  useRefetchOnFocus(projects.refetch);

  const canCreate = projectCan(undefined, "project:create", user?.permissions);

  // Same predicate as the web list: case-insensitive name match.
  const filtered = useMemo(() => {
    const rows = projects.data?.projects ?? [];
    const needle = search.trim().toLowerCase();
    return needle
      ? rows.filter((p) => p.name.toLowerCase().includes(needle))
      : rows;
  }, [projects.data, search]);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("tabs.projects")}
        right={
          canCreate ? (
            <Pressable
              testID="projects-create"
              hitSlop={12}
              onPress={() => form.current?.open()}
            >
              <Text className="text-2xl text-primary">＋</Text>
            </Pressable>
          ) : null
        }
      />
      <View className="px-4 pt-3">
        <TextInput
          testID="projects-search"
          className="mb-2 rounded-lg border border-border px-4 py-2 text-base text-primary"
          placeholder={t("project.searchPlaceholder")}
          placeholderTextColor="#a3a3a3"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>
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
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="flex-grow px-4 pb-4"
          refreshing={projects.isRefetching}
          onRefresh={() => projects.refetch()}
          ListEmptyComponent={
            <EmptyState
              message={search ? t("project.noMatch") : t("home.noProjects")}
            />
          }
          renderItem={({ item }) => (
            <ListRow
              testID={`project-row-${item.id}`}
              title={item.name}
              subtitle={item.address ?? null}
              right={
                <View className="items-end">
                  <Text className="text-sm font-medium text-primary">
                    {formatMoney(item.spent ?? 0)}
                  </Text>
                  {item.budget != null ? (
                    <Text className="text-xs text-muted-foreground">
                      / {formatMoney(item.budget)}
                    </Text>
                  ) : null}
                </View>
              }
              onPress={() => router.push(`/projects/${item.id}`)}
            />
          )}
        />
      )}
      <ProjectFormSheet
        ref={form}
        submitting={createProject.isPending}
        onSubmit={(values) =>
          createProject.mutate(
            {
              name: values.name,
              address: values.address,
              budget: values.budget,
              budget_source: values.budget_source,
            },
            {
              onSuccess: (created) => {
                form.current?.close();
                router.push(`/projects/${created.id}`);
              },
            },
          )
        }
      />
    </View>
  );
}
