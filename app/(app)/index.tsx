import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/api/client";
import { useAuth } from "@/auth/auth-context";

// The projects list response is untyped in the OpenAPI spec today; shape mirrors the API JSON.
type ProjectSummary = { id: string; name: string; status?: string };
type ProjectsResponse = { projects: ProjectSummary[]; total: number };

async function fetchProjects(): Promise<ProjectsResponse> {
  const { data, error } = await api.GET("/api/v1/projects");
  if (error || !data) throw new Error("projects request failed");
  return data as ProjectsResponse;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-4">
        <Text testID="home-welcome" className="mb-6 text-sm text-neutral-600">
          {t("home.welcome", { email: user?.email ?? "" })}
        </Text>
        <Text className="mb-3 text-2xl font-bold text-neutral-900">
          {t("home.projects")}
        </Text>

        {projects.isPending ? (
          <ActivityIndicator />
        ) : projects.isError ? (
          <Pressable onPress={() => projects.refetch()}>
            <Text className="text-red-600">
              {t("home.loadError")} {t("common.retry")}
            </Text>
          </Pressable>
        ) : (
          <FlatList
            testID="home-projects"
            data={projects.data.projects}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text className="text-neutral-500">{t("home.noProjects")}</Text>
            }
            renderItem={({ item }) => (
              <View className="mb-2 rounded-lg border border-neutral-200 px-4 py-3">
                <Text className="text-base font-medium text-neutral-900">
                  {item.name}
                </Text>
                {item.status ? (
                  <Text className="text-xs text-neutral-500">
                    {item.status}
                  </Text>
                ) : null}
              </View>
            )}
          />
        )}

        <Pressable
          testID="home-sign-out"
          onPress={() => void signOut()}
          className="mb-4 mt-6 items-center rounded-lg border border-neutral-300 py-3"
        >
          <Text className="text-base text-neutral-900">
            {t("home.signOut")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
