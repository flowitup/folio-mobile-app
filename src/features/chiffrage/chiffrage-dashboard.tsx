import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/format/money";

import type { ChiffrageArticle, ChiffrageTree } from "./chiffrage-types";

const MAX_ALERTS = 6;

type Tone = "bad" | "warn" | "good" | "mute";
type Alert = { key: string; tone: Tone; text: string };

/** Spend minus estimate of one bought article; 0 until it is bought. */
const gapOf = (a: ChiffrageArticle): number =>
  a.purchased && a.actual_ttc != null
    ? Math.round((a.actual_ttc - a.total_ttc) * 100) / 100
    : 0;

const signed = (v: number) => `${v > 0 ? "+" : ""}${formatMoney(v)}`;
const gapColor = (v: number) =>
  v < 0 ? "text-success" : v > 0 ? "text-danger" : "text-muted-foreground";
const dotColor: Record<Tone, string> = {
  bad: "bg-danger",
  warn: "bg-warning",
  good: "bg-success",
  mute: "bg-line-2",
};

/**
 * Budget dashboard above the chiffrage list: spend against the estimate, one bar pair per
 * section, and what needs attention (unpriced, over estimate, nothing bought yet, returns).
 */
export function ChiffrageDashboard({ tree }: { tree: ChiffrageTree }) {
  const { t } = useTranslation();
  const boughtArticles = tree.postes
    .flatMap((p) => p.articles)
    .filter((a) => a.purchased);
  const purchased = tree.purchased_count ?? 0;
  const actual = tree.actual_ttc ?? 0;
  const gap = boughtArticles.reduce((s, a) => s + gapOf(a), 0);
  const percent =
    tree.total_ttc > 0 ? Math.round((100 * actual) / tree.total_ttc) : 0;
  const scale = Math.max(
    1,
    ...tree.postes.map((p) => Math.max(p.subtotal_ttc, p.actual_ttc ?? 0)),
  );

  const alerts: Alert[] = [];
  for (const p of tree.postes)
    for (const a of p.articles)
      if (a.effective_source === "none")
        alerts.push({
          key: `u${a.id}`,
          tone: "bad",
          text: t("chiffrage.dashUnpriced", { name: a.name }),
        });
  for (const a of boughtArticles) {
    const g = gapOf(a);
    if (g > 0)
      alerts.push({
        key: `o${a.id}`,
        tone: "warn",
        text: t("chiffrage.dashOver", { name: a.name, amount: formatMoney(g) }),
      });
  }
  if (purchased > 0)
    for (const p of tree.postes)
      if (p.articles.length > 0 && (p.purchased_count ?? 0) === 0)
        alerts.push({
          key: `n${p.id}`,
          tone: "mute",
          text: t("chiffrage.dashNoPurchase", { name: p.name }),
        });
  for (const a of boughtArticles) {
    const r = a.returned_quantity ?? 0;
    if (r > 0 && a.quantity > 0)
      alerts.push({
        key: `r${a.id}`,
        tone: "good",
        text: t("chiffrage.dashReturned", {
          name: a.name,
          qty: `${r}${a.unit ? ` ${a.unit}` : ""}`,
          amount: formatMoney((r * a.total_ttc) / a.quantity),
        }),
      });
  }
  const shown = alerts.slice(0, MAX_ALERTS);

  return (
    <View testID="chiffrage-dashboard">
      {purchased > 0 ? (
        <Card className="mb-3" testID="chiffrage-spend">
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">
              {t("chiffrage.actualSpend")}
            </Text>
            <Text className="text-base font-semibold text-primary">
              {formatMoney(actual)}
            </Text>
          </View>
          <View className="mt-1 flex-row justify-between">
            <Text className="text-sm text-muted-foreground">
              {t("chiffrage.dashGapLabel")}
            </Text>
            <Text className={`text-sm font-semibold ${gapColor(gap)}`}>
              {signed(gap)}
            </Text>
          </View>
          <View className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
            <View
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </View>
          <Text className="mt-1 text-xs text-muted-foreground">
            {t("chiffrage.dashSpentOf", { percent })} ·{" "}
            {t("chiffrage.boughtOf", {
              done: purchased,
              total: tree.article_count ?? 0,
            })}
          </Text>
        </Card>
      ) : null}
      {tree.postes.length > 0 ? (
        <Card className="mb-3" testID="chiffrage-section-bars">
          <Text className="mb-2 text-xs uppercase text-muted-foreground">
            {t("chiffrage.dashBySection")}
          </Text>
          {tree.postes.map((p) => {
            const pg = p.articles.reduce((s, a) => s + gapOf(a), 0);
            return (
              <View key={p.id} className="mb-2">
                <View className="flex-row justify-between">
                  <Text className="flex-1 pr-2 text-sm font-medium text-primary">
                    {p.name}
                  </Text>
                  <Text
                    className={`text-sm ${(p.purchased_count ?? 0) > 0 ? gapColor(pg) : "text-muted-foreground"}`}
                  >
                    {(p.purchased_count ?? 0) > 0 ? signed(pg) : "—"}
                  </Text>
                </View>
                <View
                  className="mt-1 h-2 rounded-full bg-line-2"
                  style={{ width: `${(100 * p.subtotal_ttc) / scale}%` }}
                />
                <View
                  className="mt-1 h-2 rounded-full bg-primary"
                  style={{ width: `${(100 * (p.actual_ttc ?? 0)) / scale}%` }}
                />
              </View>
            );
          })}
          <View className="flex-row gap-4">
            <Text className="text-xs text-muted-foreground">
              {t("chiffrage.estimateShort")}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {t("chiffrage.actualShort")}
            </Text>
          </View>
        </Card>
      ) : null}
      {tree.postes.length > 0 ? (
        <Card className="mb-3" testID="chiffrage-attention">
          <Text className="mb-2 text-xs uppercase text-muted-foreground">
            {t("chiffrage.dashAttention")} ({alerts.length})
          </Text>
          {shown.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              {t("chiffrage.dashNothing")}
            </Text>
          ) : (
            shown.map((a) => (
              <View key={a.key} className="mb-1.5 flex-row items-start gap-2">
                <View
                  className={`mt-1.5 h-2 w-2 rounded-full ${dotColor[a.tone]}`}
                />
                <Text className="flex-1 text-sm text-primary">{a.text}</Text>
              </View>
            ))
          )}
          {alerts.length > shown.length ? (
            <Text className="text-xs text-muted-foreground">
              {t("chiffrage.dashMore", { count: alerts.length - shown.length })}
            </Text>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}
