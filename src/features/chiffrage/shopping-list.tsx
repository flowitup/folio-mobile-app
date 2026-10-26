import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Card, Checkbox } from "@/components/ui/primitives";
import { formatMoney, formatNumber } from "@/lib/format/money";

import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageTree,
} from "./chiffrage-types";

/**
 * Shopping list: every article grouped by section, a tick for "bought" and the amount really
 * paid next to the estimate (both TTC, so they compare line by line).
 */
export function ShoppingList({
  tree,
  canManage,
  onlyToBuy,
  busy,
  roomName,
  onToggle,
  onEditActual,
}: {
  tree: ChiffrageTree;
  canManage: boolean;
  onlyToBuy: boolean;
  busy: boolean;
  roomName: Map<string, string>;
  onToggle: (article: ChiffrageArticle, purchased: boolean) => void;
  onEditActual: (article: ChiffrageArticle) => void;
}) {
  const { t } = useTranslation();
  const all = tree.postes.flatMap((p) => p.articles);
  const bought = all.filter((a) => a.purchased);
  const estimatedBought = bought.reduce((s, a) => s + a.total_ttc, 0);
  const toBuyEstimate = all
    .filter((a) => !a.purchased)
    .reduce((s, a) => s + a.total_ttc, 0);
  const actual = tree.actual_ttc ?? 0;
  const diff = actual - estimatedBought;

  const rows = (poste: ChiffragePoste) =>
    onlyToBuy ? poste.articles.filter((a) => !a.purchased) : poste.articles;

  return (
    <View testID="shopping-list">
      <Card className="mb-3">
        <Line
          label={t("chiffrage.progress")}
          value={`${tree.purchased_count ?? 0}/${tree.article_count ?? all.length}`}
        />
        <Line
          label={t("chiffrage.toBuyEstimate")}
          value={formatMoney(toBuyEstimate)}
        />
        <Line
          testID="shopping-actual-total"
          label={t("chiffrage.actualSpend")}
          value={formatMoney(actual)}
          strong
        />
        <Line
          label={t("chiffrage.vsEstimate")}
          value={
            bought.length === 0
              ? "—"
              : `${diff > 0 ? "+" : ""}${formatMoney(diff)}`
          }
        />
      </Card>
      {tree.postes.map((poste) => {
        const list = rows(poste);
        if (list.length === 0) return null;
        return (
          <View key={poste.id} className="mb-4">
            <View className="flex-row items-center justify-between border-b border-border py-2">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-primary">
                  {poste.name}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {t("chiffrage.boughtOf", {
                    done: poste.purchased_count ?? 0,
                    total: poste.articles.length,
                  })}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs text-muted-foreground">
                  {t("chiffrage.estimateShort")}{" "}
                  {formatMoney(poste.subtotal_ttc)}
                </Text>
                <Text className="text-sm font-medium text-primary">
                  {t("chiffrage.actualShort")}{" "}
                  {formatMoney(poste.actual_ttc ?? 0)}
                </Text>
              </View>
            </View>
            {list.map((article) => (
              <View key={article.id} className="pt-3">
                <Checkbox
                  testID={`shopping-check-${article.id}`}
                  label={`${article.name} · ${formatNumber(article.quantity)}${article.unit ? ` ${article.unit}` : ""}${article.room_id && roomName.get(article.room_id) ? ` · ${roomName.get(article.room_id)}` : ""}`}
                  value={Boolean(article.purchased)}
                  onChange={(next) => {
                    if (canManage && !busy) onToggle(article, next);
                  }}
                />
                <View className="-mt-1 mb-1 ml-8 flex-row items-center justify-between">
                  <Text className="text-xs text-muted-foreground">
                    {t("chiffrage.estimateShort")}{" "}
                    {article.effective_source === "none"
                      ? t("chiffrage.unpriced")
                      : formatMoney(article.total_ttc)}
                  </Text>
                  {article.purchased ? (
                    <Pressable
                      testID={`shopping-actual-${article.id}`}
                      disabled={!canManage}
                      onPress={() => onEditActual(article)}
                      className="min-h-[44px] justify-center"
                    >
                      <Text className="text-sm text-primary">
                        {t("chiffrage.actualShort")}{" "}
                        {article.actual_ttc == null
                          ? "—"
                          : formatMoney(article.actual_ttc)}
                        {canManage ? " ✎" : ""}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Line({
  label,
  value,
  strong = false,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  testID?: string;
}) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text
        testID={testID}
        className={`text-sm text-primary ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </Text>
    </View>
  );
}
