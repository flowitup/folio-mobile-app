import { Stack, useLocalSearchParams, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";

import { ScreenHeader } from "@/components/ui/screen-header";
import type { ProjectSection } from "@/components/project/project-section-bar";

// Project sections outside the four tabs (documents, photos, notes, chiffrage…) push over the
// tab shell with the "global screen" top bar: back arrow + section title, tab bar kept.
export default function ProjectLayout() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathname = usePathname();
  const section = pathname.slice(`/projects/${id}/`.length).split("/")[0] as
    ProjectSection | "";

  return (
    <>
      <ScreenHeader
        title={section ? t(`project.sections.${section}`) : t("tabs.overview")}
        back
      />
      <Stack screenOptions={{ headerShown: false, animation: "none" }} />
    </>
  );
}
