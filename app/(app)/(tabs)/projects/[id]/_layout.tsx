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
  const rest = pathname.slice(`/projects/${id}/`.length).split("/");
  const section = rest[0] as ProjectSection | "";
  // The invoice detail (design 1b) draws its own ink header; every other section keeps the bar.
  const ownHeader =
    section === "invoices" && rest.length === 2 && rest[1] !== "new";

  return (
    <>
      {ownHeader ? null : (
        <ScreenHeader
          title={
            section ? t(`project.sections.${section}`) : t("tabs.overview")
          }
          back
        />
      )}
      <Stack screenOptions={{ headerShown: false, animation: "none" }} />
    </>
  );
}
