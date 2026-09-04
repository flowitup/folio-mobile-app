import { Stack } from "expo-router";

// Signed-in area: everything lives under the project-first tab shell (see (tabs)/_layout.tsx).
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
