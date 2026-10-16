import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { can, isCompanyAdminAnywhere } from "@/auth/permissions";
import { useAuth } from "@/auth/auth-context";
import { useShell } from "@/components/shell/shell-context";
import { openNewProjectForm } from "@/components/shell/project-switcher-sheet";
import { Button } from "@/components/ui/button";

/**
 * Home with no project yet. Whoever may create one (a company admin) gets the button the
 * switcher hides behind the top bar; everyone else learns that an admin has to add them to a
 * project, instead of a bare "No project yet." with nothing to do.
 */
export function NoProjectYet() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openSheet } = useShell();
  // Same rule as the switcher's "+ New project".
  const canCreate = can(user, "project:create") || isCompanyAdminAnywhere(user);
  return (
    <View className="items-center px-6 py-12" testID="home-no-project">
      <Text className="mb-2 text-center font-sans-semibold text-[16px] text-ink">
        {t("dashboard.noProjects")}
      </Text>
      <Text className="mb-5 text-center font-sans text-[13px] leading-[19px] text-muted">
        {t(canCreate ? "home.noProjectAdmin" : "home.noProjectMember")}
      </Text>
      {canCreate ? (
        <Button
          label={t("home.createProject")}
          onPress={() => openNewProjectForm(openSheet)}
          testID="home-create-project"
        />
      ) : null}
    </View>
  );
}
