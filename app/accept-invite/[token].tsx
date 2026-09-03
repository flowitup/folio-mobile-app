import { useLocalSearchParams } from "expo-router";

import { PlaceholderScreen } from "@/components/ui/placeholder-screen";

// Deep link target `folio://accept-invite/<token>`; the real flow lands in the settings/admin phase.
export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return (
    <PlaceholderScreen name={`accept-invite ${token?.slice(0, 8) ?? ""}`} />
  );
}
