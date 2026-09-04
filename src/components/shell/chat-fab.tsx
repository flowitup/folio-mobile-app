import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useShell } from "@/components/shell/shell-context";
import { Icon } from "@/components/ui/icon";
import { useChatChannels, useChatEnabled } from "@/features/chat/chat-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useTokens } from "@/theme/tokens";

/** The four project tab paths; the chat button only floats over these. */
const PROJECT_TAB_PATHS = new Set(["/", "/expenses", "/labor", "/planning"]);

/**
 * Floating chat button (design 2a): 52 px card circle bottom-right above the tab bar with the
 * total unread count as an accent pill. Rendered only when the backend enables chat.
 */
export function ChatFab() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();
  const pathname = usePathname();
  const { tabBarHeight, sheet } = useShell();
  const { projectId } = useSelectedProject();
  const enabled = useChatEnabled();
  const onProjectTab = PROJECT_TAB_PATHS.has(pathname);
  const channels = useChatChannels(enabled && onProjectTab);

  if (!enabled || !onProjectTab || sheet !== null) return null;
  const unread = (channels.data ?? []).reduce(
    (sum, channel) => sum + channel.unread_count,
    0,
  );

  return (
    <Pressable
      testID="chat-fab"
      accessibilityRole="button"
      accessibilityLabel={t("chat.open")}
      onPress={() =>
        router.push({
          pathname: "/chat",
          params: projectId ? { channel: `project:${projectId}` } : {},
        })
      }
      className="absolute right-4 h-[52px] w-[52px] items-center justify-center rounded-full border border-line bg-card active:opacity-70"
      style={{
        bottom: tabBarHeight + 12,
        boxShadow: "0 10px 24px -10px rgba(26,26,26,0.35)",
      }}
    >
      <Icon name="message-circle" size={24} color={tokens.ink} />
      {unread > 0 ? (
        <View
          testID="chat-fab-badge"
          className="absolute -right-[3px] -top-[3px] h-5 min-w-5 items-center justify-center rounded-full border-2 border-paper bg-accent px-[5px]"
        >
          <Text className="font-mono-bold text-[11px] text-white">
            {unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
