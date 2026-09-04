import { Stack } from "expo-router";

// Signed-in area: everything lives under the project-first tab shell (see (tabs)/_layout.tsx).
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* Team chat overlay (feature-flagged): full screen over the shell, slides in from the right. */}
      <Stack.Screen name="chat" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
