import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useShell } from "@/components/shell/shell-context";
import { useWorkerMode } from "@/features/labor/use-worker-mode";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { useTokens } from "@/theme/tokens";

/** The four project tabs, in tab-bar order; every other route in the navigator is a hidden Menu screen. */
export const PROJECT_TABS = ["index", "expenses", "labor", "planning"] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];
/** Worker mode: the same navigator, but only two routes (own attendance / own salary) and no Menu. */
export const WORKER_TABS = ["index", "expenses"] as const;

/** Props expo-router hands to a custom `tabBar` (react-navigation BottomTabBarProps). */
type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const TAB_ICONS: Record<ProjectTab | "menu", IconName> = {
  index: "home",
  expenses: "file-text",
  labor: "users",
  planning: "calendar",
  menu: "grid",
};

const TAB_LABEL_KEYS: Record<ProjectTab | "menu", string> = {
  index: "tabs.overview",
  expenses: "tabs.expenses",
  labor: "tabs.labor",
  planning: "tabs.planning",
  menu: "tabs.menu",
};

const WORKER_TAB_ICONS: Record<(typeof WORKER_TABS)[number], IconName> = {
  index: "calendar",
  expenses: "credit-card",
};
const WORKER_TAB_LABEL_KEYS: Record<(typeof WORKER_TABS)[number], string> = {
  index: "tabs.attendance",
  expenses: "tabs.salary",
};

/**
 * 2a floating tab bar: positive pill, 48px items, active item white with icon + 12/600 label
 * (flex 2.4 vs 1). The Menu item toggles the Menu sheet instead of navigating and stays active
 * while the sheet is open or a hidden (Menu-reached) screen is showing.
 */
export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const { sheet, toggleSheet, closeSheet, setTabBarHeight } = useShell();
  const { workerMode } = useWorkerMode();

  const currentName = state.routes[state.index]?.name ?? "index";
  const tabs: readonly ProjectTab[] = workerMode ? WORKER_TABS : PROJECT_TABS;
  const onProjectTab = (tabs as readonly string[]).includes(currentName);
  const menuActive = sheet === "menu" || !onProjectTab;
  const iconOf = (key: ProjectTab | "menu"): IconName =>
    workerMode && key in WORKER_TAB_ICONS
      ? WORKER_TAB_ICONS[key as keyof typeof WORKER_TAB_ICONS]
      : TAB_ICONS[key];
  const labelOf = (key: ProjectTab | "menu"): string =>
    workerMode && key in WORKER_TAB_LABEL_KEYS
      ? WORKER_TAB_LABEL_KEYS[key as keyof typeof WORKER_TAB_LABEL_KEYS]
      : TAB_LABEL_KEYS[key];

  const items: {
    key: ProjectTab | "menu";
    active: boolean;
    onPress: () => void;
  }[] = [
    ...tabs.map((name) => ({
      key: name,
      active: onProjectTab && currentName === name && sheet !== "menu",
      onPress: () => {
        closeSheet();
        const route = state.routes.find((r) => r.name === name);
        if (!route) return;
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (!event.defaultPrevented) navigation.navigate(name);
      },
    })),
    // Workers have nothing behind the Menu (no library, no project sections).
    ...(workerMode
      ? []
      : [
          {
            key: "menu" as const,
            active: menuActive,
            onPress: () => toggleSheet("menu"),
          },
        ]),
  ];

  return (
    <View
      testID="floating-tab-bar"
      onLayout={(event) => setTabBarHeight(event.nativeEvent.layout.height)}
      className="bg-paper px-4 pt-2"
      style={{ paddingBottom: Math.max(10, Math.min(insets.bottom, 30)) }}
    >
      <View
        className="flex-row rounded-full bg-positive p-1.5"
        style={{ boxShadow: "0 14px 30px -12px rgba(90,122,74,0.6)" }}
      >
        {items.map((item) => (
          <Pressable
            key={item.key}
            testID={`tab-${item.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.active }}
            accessibilityLabel={t(labelOf(item.key))}
            onPress={item.onPress}
            className={`h-12 min-w-0 flex-row items-center justify-center gap-1.5 rounded-full px-1.5 ${item.active ? "bg-white" : ""}`}
            style={{ flex: item.active ? 2.4 : 1 }}
          >
            <Icon
              name={iconOf(item.key)}
              size={22}
              color={item.active ? tokens.positive : "rgba(255,255,255,0.78)"}
            />
            {item.active ? (
              <Text
                className="font-sans-semibold text-xs text-positive"
                numberOfLines={1}
              >
                {t(labelOf(item.key))}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
