import { Tabs } from "expo-router";
import { View } from "react-native";

import { AccountSheet } from "@/components/shell/account-sheet";
import { FloatingTabBar } from "@/components/shell/floating-tab-bar";
import { MenuSheet } from "@/components/shell/menu-sheet";
import { NotificationsSheet } from "@/components/shell/notifications-sheet";
import { ProjectSwitcherSheet } from "@/components/shell/project-switcher-sheet";
import { ShellProvider } from "@/components/shell/shell-context";
import { SelectedProjectProvider } from "@/features/projects/selected-project";
import { useTokens } from "@/theme/tokens";

/** Routes that are reached through the Menu sheet; they keep the tab bar but are not tab items. */
const HIDDEN_ROUTES = [
  "billing",
  "library",
  "settings",
  "projects/[id]",
] as const;

/**
 * Project-first shell (design 2a): four tabs of the selected project plus a Menu item, one
 * floating tab bar, and the shell sheets (switcher / account / menu / reminders) rendered above
 * the content but below the tab bar.
 */
export default function TabsLayout() {
  const tokens = useTokens();
  return (
    <SelectedProjectProvider>
      <ShellProvider>
        <View className="flex-1 bg-paper">
          <Tabs
            tabBar={(props) => <FloatingTabBar {...props} />}
            screenOptions={{
              headerShown: false,
              sceneStyle: { backgroundColor: tokens.paper },
              lazy: true,
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="expenses" />
            <Tabs.Screen name="labor" />
            <Tabs.Screen name="planning" />
            {HIDDEN_ROUTES.map((name) => (
              <Tabs.Screen key={name} name={name} options={{ href: null }} />
            ))}
          </Tabs>
          <ProjectSwitcherSheet />
          <AccountSheet />
          <MenuSheet />
          <NotificationsSheet />
        </View>
      </ShellProvider>
    </SelectedProjectProvider>
  );
}
