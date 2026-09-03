import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { ProjectSectionBar } from "@/components/project/project-section-bar";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useProject } from "@/features/projects/projects-api";

// Project detail: header with the project name, then a horizontal section bar
// mirroring the web sidebar, then the section screen.
export default function ProjectLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  const router = useRouter();

  return (
    <>
      <ScreenHeader
        title={project.data?.name ?? "…"}
        back
        onBack={() => router.navigate("/(app)/(tabs)/projects")}
      />
      <ProjectSectionBar projectId={id} />
      <Stack screenOptions={{ headerShown: false, animation: "none" }} />
    </>
  );
}
