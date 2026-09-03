import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import type { ColorValue } from "react-native";

// Plain text glyphs keep the tab bar dependency-free until the design pass picks an icon set.
const TAB_GLYPHS: Record<string, string> = {
  dashboard: "◫",
  projects: "▤",
  billing: "▣",
  library: "▥",
  settings: "⚙",
};

function TabGlyph({ name, color }: { name: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 20 }}>{TAB_GLYPHS[name]}</Text>;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const tabs = [
    "dashboard",
    "projects",
    "billing",
    "library",
    "settings",
  ] as const;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#171717",
        tabBarInactiveTintColor: "#737373",
      }}
    >
      {tabs.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(`tabs.${name}`),
            tabBarIcon: ({ color }) => <TabGlyph name={name} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
