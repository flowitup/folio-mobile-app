import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "@/components/ui/placeholder-screen";

export default function ProjectNotesSection() {
  const { t } = useTranslation();
  return <PlaceholderScreen name={t("project.sections.notes")} />;
}
