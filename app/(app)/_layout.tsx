import { Stack } from "expo-router";

// Signed-in area: the tab bar is the root, project detail pushes on top of it.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="projects/[id]" />
    </Stack>
  );
}
