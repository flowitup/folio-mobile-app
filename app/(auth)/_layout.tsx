import { Stack } from "expo-router";

// Signed-out area: login and phone sign-up. A real navigator so the root session guard
// covers every screen of the group (a flat directory would leave `signup` outside it).
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
