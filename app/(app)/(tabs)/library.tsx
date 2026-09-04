import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthedImage } from "@/components/ui/authed-image";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { showToast, ToastViewport } from "@/components/ui/toast";
import { useMyCompanies } from "@/features/companies/companies-api";
import {
  productImagePath,
  useCreateProduct,
  useLibraryCategories,
  useProducts,
  useSuppliers,
  useUploadProductImage,
} from "@/features/library/library-api";
import {
  localizeCategory,
  MAX_COMPARE,
  PAGE_SIZE,
} from "@/features/library/library-helpers";
import type {
  CreateProductPayload,
  LibraryProduct,
} from "@/features/library/library-types";
import { ProductCard } from "@/features/library/product-card";
import { ProductFormSheet } from "@/features/library/product-form-sheet";
import type { PickedFile } from "@/lib/files/pick";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Company product library: filters, 2-column paged grid, compare (≤4), create with inline supplier. */
export default function LibraryTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const companies = useMyCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const effectiveCompany = companyId ?? companies.data?.[0]?.id ?? null;
  const suppliers = useSuppliers(effectiveCompany);
  const categories = useLibraryCategories(effectiveCompany);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const products = useProducts(effectiveCompany, {
    supplier,
    category,
    q,
    page,
  });
  useRefetchOnFocus(products.refetch);
  const create = useCreateProduct(effectiveCompany);
  const uploadImage = useUploadProductImage();
  const formSheet = useRef<BottomSheetModal>(null);
  const [formKey, setFormKey] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Map<string, LibraryProduct>>(
    new Map(),
  );
  const [comparing, setComparing] = useState(false);

  // Same 300 ms search debounce as the web page.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const supplierName = useMemo(
    () => new Map((suppliers.data ?? []).map((s) => [s.id, s.name])),
    [suppliers.data],
  );
  const total = products.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSelect(product: LibraryProduct) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) next.delete(product.id);
      else if (next.size >= MAX_COMPARE) {
        showToast(t("library.compareMax", { count: MAX_COMPARE }), "error");
        return prev;
      } else next.set(product.id, product);
      return next;
    });
  }

  function submitCreate(
    payload: CreateProductPayload,
    image: PickedFile | null,
  ) {
    create.mutate(payload, {
      onSuccess: (product) => {
        formSheet.current?.dismiss();
        setFormKey((k) => k + 1);
        if (image)
          uploadImage.mutate(
            { id: product.id, file: image },
            {
              onError: () => {
                showToast(t("library.toast.imageUploadWarning"), "error");
                return true;
              },
            },
          );
      },
    });
  }

  const compared = [...selected.values()];
  const cheapest = compared
    .filter((p) => p.last_unit_price != null)
    .sort((a, b) => Number(a.last_unit_price) - Number(b.last_unit_price))[0];

  if (companies.data && companies.data.length === 0)
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title={t("library.title")} />
        <EmptyState message={t("billing.form.noCompanies")} />
      </View>
    );

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("library.title")}
        right={
          <Button
            testID="library-add"
            label={`＋ ${t("library.addProduct")}`}
            size="sm"
            onPress={() => formSheet.current?.present()}
          />
        }
      />
      <View className="px-4 pt-3">
        {(companies.data?.length ?? 0) > 1 ? (
          <Select
            testID="library-company"
            value={effectiveCompany}
            options={(companies.data ?? []).map((c) => ({
              value: c.id,
              label: c.legal_name,
            }))}
            onChange={(id) => {
              setCompanyId(id);
              setSupplier(null);
              setCategory(null);
              setPage(1);
            }}
          />
        ) : null}
        <View className="mb-2 flex-row items-center gap-2">
          <TextInput
            testID="library-search"
            className="flex-1 rounded-lg border border-border px-4 py-2 text-base text-primary"
            placeholder={t("library.searchPlaceholder")}
            placeholderTextColor="#a3a3a3"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          <Button
            testID="library-compare-toggle"
            label={t("library.compare")}
            size="sm"
            variant={compareMode ? "primary" : "secondary"}
            onPress={() => {
              setCompareMode((v) => !v);
              if (compareMode) setSelected(new Map());
            }}
          />
          <Button
            testID="library-import"
            label={t("library.import")}
            size="sm"
            variant="secondary"
            onPress={() => router.push("/library/import")}
          />
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Select
              testID="library-supplier"
              value={supplier ?? "__all__"}
              options={[
                { value: "__all__", label: t("library.allSuppliers") },
                ...(suppliers.data ?? []).map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
              ]}
              onChange={(v) => {
                setSupplier(v === "__all__" ? null : v);
                setPage(1);
              }}
            />
          </View>
          <View className="flex-1">
            <Select
              testID="library-category"
              value={category ?? "__all__"}
              options={[
                { value: "__all__", label: t("library.allCategories") },
                ...(categories.data ?? []).map((slug) => ({
                  value: slug,
                  label: localizeCategory(t, slug),
                })),
              ]}
              onChange={(v) => {
                setCategory(v === "__all__" ? null : v);
                setPage(1);
              }}
            />
          </View>
        </View>
      </View>
      {products.isPending && effectiveCompany ? (
        <ActivityIndicator className="mt-8" />
      ) : null}
      <FlatList
        data={products.data?.items ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperClassName="gap-3"
        contentContainerClassName="px-4 pb-24"
        ListEmptyComponent={
          products.data ? <EmptyState message={t("library.noResults")} /> : null
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            supplierName={supplierName.get(item.supplier_id)}
            compareMode={compareMode}
            selected={selected.has(item.id)}
            onPress={() =>
              compareMode
                ? toggleSelect(item)
                : router.push(`/library/${item.id}`)
            }
            onLongPress={() => {
              setCompareMode(true);
              toggleSelect(item);
            }}
          />
        )}
        ListFooterComponent={
          total > 0 ? (
            <View className="mt-2 flex-row items-center justify-between">
              <Button
                testID="library-prev"
                label={`‹ ${t("library.previousPage")}`}
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              />
              <Text className="text-xs text-muted-foreground">
                {t("library.pageOf", { page, pages: totalPages })} ·{" "}
                {t("library.total", { count: total })}
              </Text>
              <Button
                testID="library-next"
                label={`${t("library.nextPage")} ›`}
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </View>
          ) : null
        }
      />
      {selected.size > 0 ? (
        <View className="absolute bottom-4 left-4 right-4 flex-row items-center justify-between rounded-full border border-border bg-white px-4 py-2 shadow">
          <Text className="text-sm text-primary">
            {t("library.compareSelected", { count: selected.size })}
          </Text>
          <View className="flex-row gap-2">
            <Button
              testID="compare-clear"
              label={t("library.clearSelection")}
              size="sm"
              variant="ghost"
              onPress={() => setSelected(new Map())}
            />
            <Button
              testID="compare-open"
              label={t("library.compareAction", { count: selected.size })}
              size="sm"
              disabled={selected.size < 2}
              onPress={() => setComparing(true)}
            />
          </View>
        </View>
      ) : null}

      <ProductFormSheet
        key={`create-${formKey}-${suppliers.data?.length ?? 0}`}
        ref={formSheet}
        suppliers={suppliers.data ?? []}
        submitting={create.isPending}
        onSubmit={(payload, image) =>
          submitCreate(payload as CreateProductPayload, image)
        }
      />

      <Modal
        visible={comparing}
        animationType="slide"
        onRequestClose={() => setComparing(false)}
      >
        <View className="flex-1 bg-white">
          <ScreenHeader
            title={t("library.compareTitle")}
            back
            onBack={() => setComparing(false)}
          />
          <ScrollView horizontal contentContainerClassName="p-4">
            <View className="flex-row gap-3">
              {compared.map((product) => (
                <View
                  key={product.id}
                  className="w-44 rounded-lg border border-border p-2"
                >
                  <View className="aspect-square w-full items-center justify-center overflow-hidden rounded bg-muted">
                    {product.has_image ? (
                      <AuthedImage
                        path={productImagePath(product.id)}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-2xl text-muted-foreground">▣</Text>
                    )}
                  </View>
                  <Text
                    className="mt-2 text-sm font-medium text-primary"
                    numberOfLines={2}
                  >
                    {product.name}
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {t("library.supplier")}:{" "}
                    {supplierName.get(product.supplier_id) ?? "—"}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t("library.category")}:{" "}
                    {localizeCategory(t, product.category)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t("library.size")}: {product.size ?? "—"}
                  </Text>
                  <View className="mt-1 flex-row items-center gap-1">
                    <Text className="text-xs text-muted-foreground">
                      {t("library.lastUnitPrice")}:
                    </Text>
                    <Badge
                      label={
                        product.last_unit_price != null
                          ? formatMoney(product.last_unit_price)
                          : "—"
                      }
                      tone={cheapest?.id === product.id ? "success" : "neutral"}
                    />
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {t("library.purchasedTimes", {
                      count: product.purchase_count,
                    })}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t("library.lastPurchased")}:{" "}
                    {product.last_purchased_at
                      ? formatDate(product.last_purchased_at)
                      : "—"}
                  </Text>
                  <Pressable
                    testID={`compare-remove-${product.id}`}
                    onPress={() => {
                      setSelected((prev) => {
                        const next = new Map(prev);
                        next.delete(product.id);
                        if (next.size < 2) setComparing(false);
                        return next;
                      });
                    }}
                    className="mt-2"
                  >
                    <Text className="text-xs text-danger">
                      {t("library.removeFromCompare")}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
          <ToastViewport />
        </View>
      </Modal>
    </View>
  );
}
