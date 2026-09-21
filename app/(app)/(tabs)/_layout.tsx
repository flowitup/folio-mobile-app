import { Tabs } from "expo-router";
import { View } from "react-native";

import { AccountSheet } from "@/components/shell/account-sheet";
import { ChatFab } from "@/components/shell/chat-fab";
import { FloatingTabBar } from "@/components/shell/floating-tab-bar";
import { HelpSheet } from "@/components/shell/help-sheet";
import { MenuSheet } from "@/components/shell/menu-sheet";
import { NotificationsSheet } from "@/components/shell/notifications-sheet";
import { ProjectSwitcherSheet } from "@/components/shell/project-switcher-sheet";
import { ShellProvider } from "@/components/shell/shell-context";
import {
  HIDDEN_ROUTES,
  TABS_BACK_BEHAVIOR,
} from "@/components/shell/tabs-config";
import { SelectedProjectProvider } from "@/features/projects/selected-project";
import { useTokens } from "@/theme/tokens";

/**
 * Project-first shell (design 2a): four tabs of the selected project plus a Menu item, one
 * floating tab bar, and the shell sheets (switcher / account / menu / reminders / help) rendered above
 * the content but below the tab bar.
 */
export default function TabsLayout() {
  const tokens = useTokens();
  return (
    <SelectedProjectProvider>
      <ShellProvider>
        <View className="flex-1 bg-paper">
          <Tabs
            backBehavior={TABS_BACK_BEHAVIOR}
            tabBar={(props) => <FloatingTabBar {...props} />}
            // The hidden routes (a project section, an invoice detail…) are tab screens, so a
            // back press from their first screen bubbles up here; "history" returns to the tab
            // the user came from instead of the default "firstRoute" (always Overview).
            backBehavior="history"
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
          <ChatFab />
          <ProjectSwitcherSheet />
          <AccountSheet />
          <MenuSheet />
          <NotificationsSheet />
          <HelpSheet />
        </View>
      </ShellProvider>
    </SelectedProjectProvider>
  );
}
