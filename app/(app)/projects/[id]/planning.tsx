import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "@/components/ui/placeholder-screen";

export default function ProjectPlanningSection() {
  const { t } = useTranslation();
  return <PlaceholderScreen name={t("project.sections.planning")} />;
}
