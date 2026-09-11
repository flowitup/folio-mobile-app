import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useShell } from "@/components/shell/shell-context";
import { ShellSheet } from "@/components/shell/shell-sheet";
import { Badge, ListRow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Eyebrow } from "@/components/ui/typography";
import { getHelpCatalogue } from "@/content/help";
import type { HelpTopic } from "@/content/help";
import { visibleHelpTopics } from "@/content/help/visibility";
import { useAuth } from "@/auth/auth-context";
import { isCompanyAdminAnywhere } from "@/auth/permissions";
import { useBillingAccess } from "@/features/companies/companies-api";
import { useWorkerMode } from "@/features/labor/use-worker-mode";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useProjectCan } from "@/features/projects/use-project-can";
import { useTokens } from "@/theme/tokens";

/**
 * Help sheet: the question mark next to the bell opens the list of everything the app can do;
 * tapping a topic drills into its steps in place, so the reader stays on the screen they had
 * the question about.
 */
export function HelpSheet() {
  const { t, i18n } = useTranslation();
  const { sheet } = useShell();
  const { user } = useAuth();
  const { projectId } = useSelectedProject();
  const { workerMode } = useWorkerMode();
  const canUpdateProject = useProjectCan(projectId, "project:update");
  const billing = useBillingAccess();
  const isOpen = sheet === "help";

  // The guide lists what this reader's navigation lists. A worker has no Menu at all, so every
  // Menu-reached topic would otherwise walk them through a screen they cannot open.
  const topics = visibleHelpTopics(getHelpCatalogue(i18n.language), {
    workerMode,
    canUpdateProject,
    billingAllowed: billing.allowed,
    companyAdmin: isCompanyAdminAnywhere(user),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Reopening lands on the index rather than wherever the last read finished. Reset on the way
  // in, not on the way out: the panel stays mounted through its slide-out, so clearing on close
  // makes the topic visibly snap back to the index as it slides away. Adjusting state during
  // render (rather than in an effect) is React's own pattern for reacting to a change.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setSelectedId(null);
  }

  const selected = topics.find((topic) => topic.id === selectedId) ?? null;

  return (
    <ShellSheet open={isOpen} testID="help-sheet" scroll>
      {selected ? (
        <TopicDetail topic={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <View>
          <Eyebrow className="mb-2">{t("help.title")}</Eyebrow>
          <Text className="mb-3 font-sans text-[12.5px] text-muted">
            {t("help.subtitle")}
          </Text>
          <View className="overflow-hidden rounded-xl border border-line bg-card">
            {topics.map((topic) => (
              <ListRow
                key={topic.id}
                testID={`help-topic-${topic.id}`}
                title={topic.title}
                subtitle={topic.purpose}
                grouped
                chevron
                onPress={() => setSelectedId(topic.id)}
              />
            ))}
          </View>
        </View>
      )}
    </ShellSheet>
  );
}

function TopicDetail({
  topic,
  onBack,
}: {
  topic: HelpTopic;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const tokens = useTokens();

  return (
    <View testID="help-topic-detail">
      <Pressable
        testID="help-back"
        accessibilityRole="button"
        onPress={onBack}
        hitSlop={8}
        className="mb-3 flex-row items-center gap-1.5 self-start active:opacity-70"
      >
        <Icon name="arrow-left" size={14} color={tokens.muted} />
        <Text className="font-sans text-xs text-muted">{t("help.back")}</Text>
      </Pressable>

      <Text className="font-serif text-[20px] leading-[24px] text-ink">
        {topic.title}
      </Text>
      {topic.workerMode ? (
        <View className="mt-2">
          <Badge label={t("help.workerBadge")} tone="neutral" />
        </View>
      ) : null}
      <Text className="mb-4 mt-2 font-sans text-[13px] leading-[19px] text-muted">
        {topic.purpose}
      </Text>

      <Eyebrow className="mb-2">{t("help.steps")}</Eyebrow>
      <View className="mb-4 gap-2.5">
        {topic.steps.map((step, index) => (
          <View key={`${topic.id}-step-${index}`} className="flex-row gap-2.5">
            <View className="mt-px h-5 w-5 items-center justify-center rounded-full bg-accent-tint">
              <Text className="font-sans-semibold text-[11px] text-accent-ink">
                {index + 1}
              </Text>
            </View>
            <Text className="flex-1 font-sans text-[13px] leading-[19px] text-ink">
              {step}
            </Text>
          </View>
        ))}
      </View>

      <Eyebrow className="mb-1.5">{t("help.whoCanDoIt")}</Eyebrow>
      <Text className="mb-4 font-sans text-[13px] leading-[19px] text-ink">
        {topic.whoCanDoIt}
      </Text>

      {topic.webOnlyNote ? (
        <>
          <Eyebrow className="mb-1.5">{t("help.webOnly")}</Eyebrow>
          <Text className="mb-4 font-sans text-[13px] leading-[19px] text-ink">
            {topic.webOnlyNote}
          </Text>
        </>
      ) : null}

      {topic.gotchas && topic.gotchas.length > 0 ? (
        <>
          <Eyebrow className="mb-1.5">{t("help.gotchas")}</Eyebrow>
          <View className="mb-2 gap-1.5">
            {topic.gotchas.map((gotcha, index) => (
              <View
                key={`${topic.id}-gotcha-${index}`}
                className="flex-row gap-2"
              >
                <Text className="font-sans text-[13px] leading-[19px] text-muted">
                  •
                </Text>
                <Text className="flex-1 font-sans text-[13px] leading-[19px] text-ink">
                  {gotcha}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
