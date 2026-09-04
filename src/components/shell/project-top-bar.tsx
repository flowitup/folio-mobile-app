import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { useShell } from "@/components/shell/shell-context";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useNotifications } from "@/features/notes/notes-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useTokens } from "@/theme/tokens";

/**
 * Top bar of the four project tabs: project switcher (28px ink square + name + "Đổi công trình ▾"),
 * 40px bell with an accent dot when reminders are pending, 36px initials avatar.
 */
export function ProjectTopBar() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { project, isPending } = useSelectedProject();
  const { openSheet } = useShell();
  const notifications = useNotifications();
  const pendingCount = (notifications.data ?? []).filter(
    (item) => !item.dismissed,
  ).length;

  return (
    <View
      testID="project-top-bar"
      className="flex-row items-center gap-2 border-b border-line bg-paper px-3 pb-2"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Pressable
        testID="top-bar-switcher"
        accessibilityRole="button"
        onPress={() => openSheet("switcher")}
        className="h-10 min-w-0 flex-1 flex-row items-center gap-2 active:opacity-70"
      >
        <Avatar name={project?.name ?? "F"} size={28} square />
        <View className="min-w-0 flex-1">
          <Text
            className="font-sans-semibold text-[15px] text-ink"
            numberOfLines={1}
          >
            {project?.name ?? (isPending ? "…" : t("home.noProjects"))}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="font-sans text-[11px] text-muted">
              {t("shell.switchProject")}
            </Text>
            <Icon name="chevron-down" size={10} color={tokens.muted} />
          </View>
        </View>
      </Pressable>
      <Pressable
        testID="top-bar-bell"
        accessibilityRole="button"
        accessibilityLabel={t("notifications.title", { count: pendingCount })}
        onPress={() => openSheet("notifications")}
        className="h-10 w-10 items-center justify-center active:opacity-70"
      >
        <Icon name="bell" size={20} color={tokens.ink} />
        {pendingCount > 0 ? (
          <View
            testID="top-bar-bell-dot"
            className="absolute right-2.5 top-[9px] h-2 w-2 rounded-full border-2 border-paper bg-accent"
            style={{ width: 10, height: 10 }}
          />
        ) : null}
      </Pressable>
      <Pressable
        testID="top-bar-account"
        accessibilityRole="button"
        onPress={() => openSheet("account")}
        className="active:opacity-70"
      >
        <Avatar name={user?.email} size={36} />
      </Pressable>
    </View>
  );
}
