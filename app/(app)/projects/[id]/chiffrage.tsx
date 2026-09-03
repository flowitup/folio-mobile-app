import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AuthedImage } from "@/components/ui/authed-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import {
  articleImagePath,
  useChiffrage,
  useChiffrageActions,
  useChiffrageUnits,
} from "@/features/chiffrage/chiffrage-api";
import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageQuote,
  ChiffrageStore,
} from "@/features/chiffrage/chiffrage-types";
import { captureImage, pickImages } from "@/lib/files/pick";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

type SheetKind =
  "poste" | "article" | "quote" | "store" | "room" | "unit" | null;

/** Material provisioning (chiffrage): postes → articles (by room) → quotes per shop; totals and shop baskets. */
export default function ProjectChiffrageSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tree = useChiffrage(id);
  const units = useChiffrageUnits(id);
  const actions = useChiffrageActions(id);
  useRefetchOnFocus(tree.refetch);

  const sheet = useRef<BottomSheetModal>(null);
  const [kind, setKind] = useState<SheetKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{
    title: string;
    run: () => void;
  } | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const storeName = useMemo(
    () => new Map((tree.data?.stores ?? []).map((s) => [s.id, s.name])),
    [tree.data],
  );
  const roomName = useMemo(
    () => new Map((tree.data?.rooms ?? []).map((r) => [r.id, r.name])),
    [tree.data],
  );
  const set = (key: string) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function open(
    next: SheetKind,
    editing: string | null = null,
    parent: string | null = null,
    initial: Record<string, string> = {},
  ) {
    setKind(next);
    setEditingId(editing);
    setParentId(parent);
    setDraft(initial);
    sheet.current?.present();
  }
  const close = () => sheet.current?.dismiss();
  const done = { onSuccess: close };

  function submit() {
    const name = (draft.name ?? "").trim();
    switch (kind) {
      case "poste":
        if (!name) return showToast(t("chiffrage.nameRequired"), "error");
        return editingId
          ? actions.updatePoste.mutate(
              { posteId: editingId, name, note: draft.note?.trim() || null },
              done,
            )
          : actions.createPoste.mutate(
              { name, note: draft.note?.trim() || null },
              done,
            );
      case "article": {
        if (!name) return showToast(t("chiffrage.nameRequired"), "error");
        const payload = {
          name,
          quantity: parseMoneyInput(draft.quantity ?? "1") ?? 1,
          unit: draft.unit || null,
          room_id: draft.room_id || null,
          note: draft.note?.trim() || null,
        };
        return editingId
          ? actions.updateArticle.mutate(
              { articleId: editingId, ...payload },
              done,
            )
          : parentId &&
              actions.createArticle.mutate(
                { posteId: parentId, ...payload },
                done,
              );
      }
      case "quote": {
        const price = parseMoneyInput(draft.unit_price_ht ?? "");
        if (price == null)
          return showToast(t("chiffrage.priceRequired"), "error");
        const payload = {
          unit_price_ht: price,
          tva_rate: parseMoneyInput(draft.tva_rate ?? "20") ?? 20,
          store_id: draft.store_id || null,
          supplier_name: draft.supplier_name?.trim() || null,
          product_url: draft.product_url?.trim() || null,
          note: draft.note?.trim() || null,
        };
        return editingId
          ? actions.updateQuote.mutate({ quoteId: editingId, ...payload }, done)
          : parentId &&
              actions.createQuote.mutate(
                { articleId: parentId, ...payload },
                done,
              );
      }
      case "store": {
        if (!name) return showToast(t("chiffrage.nameRequired"), "error");
        const payload = {
          name,
          address: draft.address?.trim() || null,
          website_url: draft.website_url?.trim() || null,
        };
        if (editingId)
          return actions.updateStore.mutate(
            { storeId: editingId, ...payload },
            done,
          );
        return parentId
          ? actions.createStoreForPoste.mutate(
              { posteId: parentId, ...payload },
              done,
            )
          : actions.createStore.mutate(payload, done);
      }
      case "room":
        if (!name) return showToast(t("chiffrage.nameRequired"), "error");
        return editingId
          ? actions.updateRoom.mutate({ roomId: editingId, name }, done)
          : actions.createRoom.mutate({ name }, done);
      case "unit":
        if (!name) return showToast(t("chiffrage.nameRequired"), "error");
        return actions.createUnit.mutate({ symbol: name }, done);
    }
  }

  async function pickArticleImage(
    article: ChiffrageArticle,
    source: "camera" | "library",
  ) {
    const result =
      source === "camera" ? await captureImage() : await pickImages(false);
    if (result.status === "denied")
      return showToast(t("invoices.attachments.permissionDenied"), "error");
    if (result.status === "picked")
      actions.uploadArticleImage.mutate({
        articleId: article.id,
        file: result.files[0],
      });
  }

  if (tree.isPending) return <ActivityIndicator className="mt-8" />;
  const data = tree.data;
  if (!data)
    return <Text className="p-4 text-danger">{t("home.loadError")}</Text>;

  const busy = Object.values(actions).some((m) => m.isPending);
  const storeOptions = data.stores.map((s) => ({ value: s.id, label: s.name }));
  const roomOptions = data.rooms.map((r) => ({ value: r.id, label: r.name }));
  const unitOptions = (units.data ?? []).map((u) => ({
    value: u.symbol,
    label: u.symbol,
  }));

  const renderQuote = (article: ChiffrageArticle, quote: ChiffrageQuote) => (
    <View
      key={quote.id}
      className={`mt-1 flex-row items-center rounded border px-2 py-1 ${quote.is_selected ? "border-primary bg-muted" : "border-border"}`}
    >
      <Pressable
        testID={`quote-select-${quote.id}`}
        onPress={() => actions.selectQuote.mutate({ quoteId: quote.id })}
        className="mr-2"
      >
        <Text className="text-base">{quote.is_selected ? "◉" : "○"}</Text>
      </Pressable>
      <Pressable
        className="flex-1"
        onPress={() =>
          open("quote", quote.id, article.id, {
            unit_price_ht: String(quote.unit_price_ht),
            tva_rate: String(quote.tva_rate),
            store_id: quote.store_id ?? "",
            supplier_name: quote.supplier_name ?? "",
            product_url: quote.product_url ?? "",
            note: quote.note ?? "",
          })
        }
      >
        <Text className="text-sm text-primary">
          {quote.store_id
            ? storeName.get(quote.store_id)
            : (quote.supplier_name ?? t("chiffrage.noShop"))}{" "}
          · {formatMoney(quote.unit_price_ht)} HT ·{" "}
          {formatMoney(quote.unit_price_ttc)} TTC
        </Text>
        {quote.note ? (
          <Text className="text-xs text-muted-foreground">{quote.note}</Text>
        ) : null}
      </Pressable>
      <Pressable
        testID={`quote-delete-${quote.id}`}
        onPress={() =>
          setConfirm({
            title: t("chiffrage.deleteQuote"),
            run: () => actions.deleteQuote.mutate({ quoteId: quote.id }),
          })
        }
      >
        <Text className="text-xs text-danger">✕</Text>
      </Pressable>
    </View>
  );

  const renderArticle = (poste: ChiffragePoste, article: ChiffrageArticle) => {
    const image = articleImagePath(id, article);
    const expanded = expandedArticle === article.id;
    return (
      <Card key={article.id} className="mb-2">
        <Pressable
          onPress={() => setExpandedArticle(expanded ? null : article.id)}
          className="flex-row items-center"
        >
          {image ? (
            <AuthedImage
              path={image}
              style={{ width: 40, height: 40, borderRadius: 4, marginRight: 8 }}
              resizeMode="cover"
            />
          ) : null}
          <View className="flex-1">
            <Text className="text-base font-medium text-primary">
              {article.name}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {article.quantity} {article.unit ?? ""}
              {article.room_id
                ? ` · ${roomName.get(article.room_id) ?? ""}`
                : ""}{" "}
              ·{" "}
              {article.effective_source === "none"
                ? t("chiffrage.unpriced")
                : `${formatMoney(article.total_ttc)} TTC (${t(`chiffrage.source.${article.effective_source}`)})`}
            </Text>
          </View>
          <Badge label={String(article.quotes.length)} />
        </Pressable>
        {expanded ? (
          <View className="mt-2">
            {article.quotes.map((quote) => renderQuote(article, quote))}
            <View className="mt-2 flex-row flex-wrap gap-3">
              <Pressable
                testID={`article-add-quote-${article.id}`}
                onPress={() =>
                  open("quote", null, article.id, { tva_rate: "20" })
                }
              >
                <Text className="text-sm text-primary">
                  {t("chiffrage.addQuote")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  open("article", article.id, poste.id, {
                    name: article.name,
                    quantity: String(article.quantity),
                    unit: article.unit ?? "",
                    room_id: article.room_id ?? "",
                    note: article.note ?? "",
                  })
                }
              >
                <Text className="text-sm text-primary">{t("common.edit")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void pickArticleImage(article, "library")}
              >
                <Text className="text-sm text-primary">
                  {t("chiffrage.image")}
                </Text>
              </Pressable>
              {image ? (
                <Pressable
                  onPress={() =>
                    actions.deleteArticleImage.mutate({ articleId: article.id })
                  }
                >
                  <Text className="text-sm text-muted-foreground">
                    {t("chiffrage.removeImage")}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() =>
                  setConfirm({
                    title: t("chiffrage.deleteArticle", { name: article.name }),
                    run: () =>
                      actions.deleteArticle.mutate({ articleId: article.id }),
                  })
                }
              >
                <Text className="text-sm text-danger">
                  {t("common.delete")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-4 pb-12">
        <Card className="mb-3">
          <View className="flex-row justify-between">
            <Text className="text-sm text-muted-foreground">
              {t("chiffrage.totalHt")}
            </Text>
            <Text className="text-sm text-primary">
              {formatMoney(data.total_ht)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-base font-semibold text-primary">
              {t("chiffrage.totalTtc")}
            </Text>
            <Text className="text-base font-semibold text-primary">
              {formatMoney(data.total_ttc)}
            </Text>
          </View>
          {data.unpriced_article_count > 0 ? (
            <Text className="mt-1 text-xs text-warning">
              {t("chiffrage.unpricedCount", {
                count: data.unpriced_article_count,
              })}
            </Text>
          ) : null}
          {data.store_baskets.slice(0, 3).map((basket) => (
            <Text
              key={basket.store_id}
              className="mt-1 text-xs text-muted-foreground"
            >
              {storeName.get(basket.store_id) ?? basket.store_id}:{" "}
              {formatMoney(basket.basket_ttc)} TTC ·{" "}
              {basket.priced_article_count}/{basket.total_article_count}
              {basket.covers_all ? ` · ${t("chiffrage.coversAll")}` : ""}
            </Text>
          ))}
        </Card>
        <View className="mb-3 flex-row flex-wrap gap-2">
          <Button
            testID="chiffrage-add-poste"
            label={t("chiffrage.addPoste")}
            size="sm"
            onPress={() => open("poste")}
          />
          <Button
            testID="chiffrage-add-store"
            label={t("chiffrage.addStore")}
            size="sm"
            variant="secondary"
            onPress={() => open("store")}
          />
          <Button
            testID="chiffrage-add-room"
            label={t("chiffrage.addRoom")}
            size="sm"
            variant="secondary"
            onPress={() => open("room")}
          />
          <Button
            testID="chiffrage-add-unit"
            label={t("chiffrage.addUnit")}
            size="sm"
            variant="secondary"
            onPress={() => open("unit")}
          />
        </View>
        {data.stores.length > 0 ? (
          <View className="mb-3 flex-row flex-wrap gap-1">
            {data.stores.map((store: ChiffrageStore) => (
              <Pressable
                key={store.id}
                onPress={() =>
                  open("store", store.id, null, {
                    name: store.name,
                    address: store.address ?? "",
                    website_url: store.website_url ?? "",
                  })
                }
                onLongPress={() =>
                  setConfirm({
                    title: t("chiffrage.deleteStore", { name: store.name }),
                    run: () =>
                      actions.deleteStore.mutate({ storeId: store.id }),
                  })
                }
              >
                <Badge label={store.name} />
              </Pressable>
            ))}
            {data.rooms.map((room) => (
              <Pressable
                key={room.id}
                onPress={() => open("room", room.id, null, { name: room.name })}
                onLongPress={() =>
                  setConfirm({
                    title: t("chiffrage.deleteRoom", { name: room.name }),
                    run: () => actions.deleteRoom.mutate({ roomId: room.id }),
                  })
                }
              >
                <Badge label={`⌂ ${room.name}`} tone="success" />
              </Pressable>
            ))}
          </View>
        ) : null}
        {data.postes.length === 0 ? (
          <EmptyState message={t("chiffrage.none")} />
        ) : null}
        {data.postes.map((poste, index) => (
          <View key={poste.id} className="mb-4">
            <View className="flex-row items-center justify-between border-b border-border py-2">
              <Pressable
                className="flex-1"
                onPress={() =>
                  open("poste", poste.id, null, {
                    name: poste.name,
                    note: poste.note ?? "",
                  })
                }
              >
                <Text className="text-lg font-semibold text-primary">
                  {poste.name}
                </Text>
                {poste.note ? (
                  <Text className="text-xs text-muted-foreground">
                    {poste.note}
                  </Text>
                ) : null}
              </Pressable>
              <Text className="text-sm font-medium text-primary">
                {formatMoney(poste.subtotal_ttc)}
              </Text>
            </View>
            <View className="my-2 flex-row flex-wrap gap-3">
              <Pressable
                testID={`poste-add-article-${poste.id}`}
                onPress={() =>
                  open("article", null, poste.id, { quantity: "1" })
                }
              >
                <Text className="text-sm text-primary">
                  {t("chiffrage.addArticle")}
                </Text>
              </Pressable>
              <Pressable onPress={() => open("store", null, poste.id)}>
                <Text className="text-sm text-primary">
                  {t("chiffrage.addStoreToPoste")}
                </Text>
              </Pressable>
              <Pressable
                disabled={index === 0}
                onPress={() =>
                  actions.reorderPoste.mutate({
                    posteId: poste.id,
                    beforeId: data.postes[index - 1]?.id,
                  })
                }
              >
                <Text
                  className={
                    index === 0 ? "text-muted-foreground" : "text-primary"
                  }
                >
                  ↑
                </Text>
              </Pressable>
              <Pressable
                disabled={index === data.postes.length - 1}
                onPress={() =>
                  actions.reorderPoste.mutate({
                    posteId: poste.id,
                    afterId: data.postes[index + 1]?.id,
                  })
                }
              >
                <Text
                  className={
                    index === data.postes.length - 1
                      ? "text-muted-foreground"
                      : "text-primary"
                  }
                >
                  ↓
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setConfirm({
                    title: t("chiffrage.deletePoste", { name: poste.name }),
                    run: () =>
                      actions.deletePoste.mutate({ posteId: poste.id }),
                  })
                }
              >
                <Text className="text-sm text-danger">
                  {t("common.delete")}
                </Text>
              </Pressable>
            </View>
            {poste.articles.map((article) => renderArticle(poste, article))}
            {poste.store_baskets.length > 0 ? (
              <Text className="text-xs text-muted-foreground">
                {poste.store_baskets
                  .map(
                    (b) =>
                      `${storeName.get(b.store_id) ?? ""} ${formatMoney(b.basket_ttc)}${b.covers_all ? " ✓" : ""}`,
                  )
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <Sheet
        ref={sheet}
        title={kind ? t(`chiffrage.sheet.${kind}`) : ""}
        snapPoints={["80%"]}
      >
        <ScrollView
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
        >
          {kind === "quote" ? (
            <>
              <Input
                testID="quote-price"
                label={t("chiffrage.unitPriceHt")}
                value={draft.unit_price_ht ?? ""}
                onChangeText={set("unit_price_ht")}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Input
                testID="quote-tva"
                label={t("invoices.form.vatRate")}
                value={draft.tva_rate ?? "20"}
                onChangeText={set("tva_rate")}
                keyboardType="decimal-pad"
              />
              <Select
                testID="quote-store"
                label={t("chiffrage.shop")}
                placeholder={t("chiffrage.noShop")}
                value={draft.store_id || null}
                options={storeOptions}
                onChange={set("store_id")}
              />
              <Input
                testID="quote-supplier"
                label={t("chiffrage.supplierName")}
                value={draft.supplier_name ?? ""}
                onChangeText={set("supplier_name")}
              />
              <Input
                testID="quote-url"
                label={t("chiffrage.productUrl")}
                value={draft.product_url ?? ""}
                onChangeText={set("product_url")}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Input
                testID="quote-note"
                label={t("invoices.form.notes")}
                value={draft.note ?? ""}
                onChangeText={set("note")}
                multiline
              />
            </>
          ) : (
            <>
              <Input
                testID="chiffrage-name"
                label={
                  kind === "unit"
                    ? t("chiffrage.unitSymbol")
                    : t("project.form.name")
                }
                value={draft.name ?? ""}
                onChangeText={set("name")}
                autoFocus
              />
              {kind === "article" ? (
                <>
                  <Input
                    testID="article-quantity"
                    label={t("invoices.form.quantity")}
                    value={draft.quantity ?? "1"}
                    onChangeText={set("quantity")}
                    keyboardType="decimal-pad"
                  />
                  <Select
                    testID="article-unit"
                    label={t("chiffrage.unit")}
                    placeholder="—"
                    value={draft.unit || null}
                    options={unitOptions}
                    onChange={set("unit")}
                  />
                  <Select
                    testID="article-room"
                    label={t("chiffrage.room")}
                    placeholder={t("chiffrage.noRoom")}
                    value={draft.room_id || null}
                    options={roomOptions}
                    onChange={set("room_id")}
                  />
                </>
              ) : null}
              {kind === "store" ? (
                <>
                  <Input
                    testID="store-address"
                    label={t("project.form.address")}
                    value={draft.address ?? ""}
                    onChangeText={set("address")}
                  />
                  <Input
                    testID="store-url"
                    label={t("chiffrage.website")}
                    value={draft.website_url ?? ""}
                    onChangeText={set("website_url")}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </>
              ) : null}
              {kind === "poste" || kind === "article" ? (
                <Input
                  testID="chiffrage-note"
                  label={t("invoices.form.notes")}
                  value={draft.note ?? ""}
                  onChangeText={set("note")}
                  multiline
                />
              ) : null}
            </>
          )}
          <Button
            testID="chiffrage-submit"
            label={t("common.save")}
            loading={busy}
            onPress={submit}
          />
        </ScrollView>
      </Sheet>
      <ConfirmDialog
        visible={confirm !== null}
        title={confirm?.title ?? ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.run();
          setConfirm(null);
        }}
      />
    </View>
  );
}
