import "../global.css";
import "@/i18n";

import {
  Fraunces_400Regular,
  Fraunces_500Medium,
} from "@expo-google-fonts/fraunces";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth/auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { useTokens } from "@/theme/tokens";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// The three design families, one file per weight (see tailwind.config.js fontFamily).
const FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Fraunces_400Regular,
  Fraunces_500Medium,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
};

function Splash() {
  const tokens = useTokens();
  return (
    <View className="flex-1 items-center justify-center bg-paper">
      <ActivityIndicator size="large" color={tokens.ink} />
    </View>
  );
}

// Route groups are guarded by session state: (app) needs a session, (auth) needs none.
// accept-invite is reachable in both states (deep link), the screen decides what to show.
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useAuth();

  if (status === "loading" || !fontsReady) return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="accept-invite/[token]" />
    </Stack>
  );
}

export default function RootLayout() {
  // A font load error (never seen on device) must not block the app: fall back to system fonts.
  const [fontsLoaded, fontsError] = useFonts(FONTS);
  const fontsReady = fontsLoaded || Boolean(fontsError);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BottomSheetModalProvider>
              <ToastProvider>
                <StatusBar style="auto" />
                <RootNavigator fontsReady={fontsReady} />
              </ToastProvider>
            </BottomSheetModalProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
