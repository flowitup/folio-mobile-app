import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

import { useSelectedProject } from "@/features/projects/selected-project";

// Legacy / deep-link route: select the project and show its tab in the shell.
export default function ProjectSectionRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { select } = useSelectedProject();
  useEffect(() => {
    if (id) select(id);
  }, [id, select]);
  return <Redirect href="/(app)/(tabs)/expenses" />;
}
