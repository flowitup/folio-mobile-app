import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AuthedImage } from "@/components/ui/authed-image";
import { Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import type { ChatMessage } from "@/features/chat/chat-api";
import { useAssistantAction } from "@/features/chat/chat-api";
import { selectProjectOnNextShell } from "@/features/projects/selected-project";
import {
  ASSISTANT_BADGE_I18N_KEY,
  ASSISTANT_BADGE_TONE,
  ASSISTANT_JOB_STATUS_I18N_KEY,
  type AssistantCardPayload,
  type AssistantChoiceOption,
  type AssistantChoicePayload,
  type AssistantJobState,
  type AssistantJobStatusPayload,
  isChosenOption,
} from "@/lib/chat/assistant";
import { ApiError } from "@/lib/query/api-error";
import { useTokens } from "@/theme/tokens";

/** Icon shown for a job status that is not actively running (those show a spinner instead). */
const JOB_STATE_ICON: Record<AssistantJobState, IconName> = {
  queued: "clock",
  running: "clock",
  not_ready: "clock",
  blocked: "alert-triangle",
  done: "check-circle",
  failed: "x-circle",
  not_found: "help-circle",
};

/**
 * Assistant "card" content: a tappable thumbnail + title/subtitle/badge for an invoice or a
 * material, deep-linking into the existing detail screens. Selects the invoice's project in
 * the shell first (the assistant channel is not scoped to a project like the others).
 */
export function AssistantCard({ payload }: { payload: AssistantCardPayload }) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();

  // An invoice screen lives under its project: without a project id there is nowhere to
  // go, so the card stays informational instead of routing to `/projects/null/...`.
  const canOpen = payload.type === "material" || payload.projectId !== null;

  function open() {
    if (payload.type === "invoice") {
      if (!payload.projectId) return;
      selectProjectOnNextShell(payload.projectId);
      router.push(`/projects/${payload.projectId}/invoices/${payload.id}`);
    } else {
      router.push(`/library/${payload.id}`);
    }
  }

  return (
    <Pressable
      testID="assistant-card"
      accessibilityRole="button"
      accessibilityLabel={t(
        payload.type === "invoice"
          ? "assistant.openInvoice"
          : "assistant.openMaterial",
      )}
      accessibilityState={{ disabled: !canOpen }}
      disabled={!canOpen}
      onPress={open}
      className="w-[220px] overflow-hidden rounded-[14px] border border-line bg-card active:opacity-70"
    >
      {payload.thumbnailUrl ? (
        <View className="h-[110px] items-center justify-center bg-paper-2">
          <Icon name="image" size={26} color={tokens.muted} />
          <AuthedImage
            path={payload.thumbnailUrl}
            style={{ position: "absolute", width: 220, height: 110 }}
            resizeMode="cover"
            accessibilityLabel={payload.title}
          />
        </View>
      ) : null}
      <View className="gap-1 px-3 py-2.5">
        <Text
          testID="assistant-card-title"
          className="font-sans-medium text-[13.5px] text-ink"
          numberOfLines={2}
        >
          {payload.title}
        </Text>
        {payload.subtitle ? (
          <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>
            {payload.subtitle}
          </Text>
        ) : null}
        {payload.badge ? (
          <Badge
            testID="assistant-card-badge"
            label={t(ASSISTANT_BADGE_I18N_KEY[payload.badge])}
            tone={ASSISTANT_BADGE_TONE[payload.badge]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Assistant "choice" content: the prompt plus one full-width outlined button per option. A
 * tap fires the actions endpoint (optimistic `answered` on the message cache — see
 * `useAssistantAction`); once answered (locally or by the server) every button is inert, the
 * chosen one filled.
 */
export function AssistantChoice({
  message,
  payload,
}: {
  message: ChatMessage;
  payload: AssistantChoicePayload;
}) {
  const { t } = useTranslation();
  const action = useAssistantAction(message.channel_key);
  // Local optimistic pick, on top of the query-cache one `useAssistantAction` writes: this
  // widget instance survives across polls of the same message (`key={message.id}` in the
  // list above), but nothing here guarantees a subscriber re-renders it from the cache the
  // instant the mutation starts, so the tap has to make its own button state immediately.
  // The server's `payload.answered` (once it arrives) always wins over this guess.
  const [pendingChoice, setPendingChoice] =
    useState<AssistantChoiceOption | null>(null);
  const answered = payload.answered ?? pendingChoice?.action ?? null;
  // A server that only recorded the action (no `answered_payload`) still gets the exact
  // option from the local tap while this widget lives.
  const answeredPayload =
    payload.answeredPayload ?? pendingChoice?.payload ?? null;

  return (
    <View
      testID="assistant-choice"
      className="w-[260px] gap-2.5 rounded-[14px] border border-line bg-card p-3"
    >
      <Text className="font-sans text-[13.5px] leading-5 text-ink">
        {payload.prompt}
      </Text>
      <View className="gap-1.5">
        {payload.options.map((option, index) => {
          const chosen = isChosenOption(option, answered, answeredPayload);
          const disabled = answered !== null || action.isPending;
          return (
            <Pressable
              key={`${option.action}-${index}`}
              testID={`assistant-choice-option-${option.action}`}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: chosen }}
              disabled={disabled}
              onPress={() => {
                setPendingChoice(option);
                action.mutate(
                  {
                    action: option.action,
                    payload: option.payload,
                    reply_to_id: message.id,
                  },
                  {
                    onError: (error) => {
                      // A 409 means the server already has an answer; the next poll brings
                      // it in, so keep showing this pick rather than reverting to nothing.
                      if (!(error instanceof ApiError && error.status === 409))
                        setPendingChoice(null);
                    },
                  },
                );
              }}
              className={`h-10 items-center justify-center rounded-[10px] border px-3 ${
                chosen ? "border-ink bg-ink" : "border-line-2 bg-transparent"
              } ${disabled && !chosen ? "opacity-50" : "active:opacity-70"}`}
            >
              <Text
                className={`font-sans-medium text-[13px] ${chosen ? "text-on-ink" : "text-ink"}`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {answered ? (
        <Text
          testID="assistant-choice-answered"
          className="font-sans text-[11px] text-muted"
        >
          {t("assistant.answered")}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Assistant "job_status" content: spinner while queued/running, a state label otherwise, and
 * a progress bar when the job reports a fraction (0..1) complete.
 */
export function AssistantJobStatus({
  payload,
}: {
  payload: AssistantJobStatusPayload;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const busy = payload.state === "queued" || payload.state === "running";
  const progress =
    payload.progress === null
      ? null
      : Math.round(Math.min(1, Math.max(0, payload.progress)) * 100);

  return (
    <View
      testID="assistant-job-status"
      className="w-[220px] gap-2 rounded-[14px] border border-line bg-card p-3"
    >
      <View className="flex-row items-center gap-2">
        {busy ? (
          <ActivityIndicator
            testID="assistant-job-status-spinner"
            size="small"
            color={tokens.ink}
          />
        ) : (
          <Icon
            name={JOB_STATE_ICON[payload.state]}
            size={16}
            color={tokens.muted}
          />
        )}
        <Text className="flex-1 font-sans text-[13px] text-ink">
          {payload.text}
        </Text>
      </View>
      <Text
        testID="assistant-job-status-label"
        className="font-sans text-[11px] text-muted"
      >
        {t(ASSISTANT_JOB_STATUS_I18N_KEY[payload.state])}
      </Text>
      {progress !== null ? (
        <View className="h-1.5 overflow-hidden rounded-full bg-paper-2">
          <View
            testID="assistant-job-status-progress"
            className="h-full rounded-full bg-accent"
            style={{ width: `${progress}%` }}
          />
        </View>
      ) : null}
    </View>
  );
}
