import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { useProducts, useSuppliers } from "@/features/library/library-api";
import type { LibraryProduct } from "@/features/library/library-types";
import { formatMoney } from "@/lib/format/money";

export interface PickedProduct {
  supplierId: string | null;
  supplierName: string;
  productId: string;
  productName: string;
  productUrl: string | null;
  /** Last purchase price, offered as a starting point only. */
  suggestedPrice: string | null;
}

type Props = {
  companyId: string | null;
  onPick: (picked: PickedProduct) => void;
};

/** Search the company product library (supplier filter + 300 ms debounced query) and pick a product for a quote. */
export const LibraryProductPickerSheet = forwardRef<BottomSheetModal, Props>(
  function LibraryProductPickerSheet({ companyId, onPick }, ref) {
    const { t } = useTranslation();
    const suppliers = useSuppliers(companyId);
    const [supplier, setSupplier] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    useEffect(() => {
      const handle = setTimeout(() => setQ(search.trim()), 300);
      return () => clearTimeout(handle);
    }, [search]);
    const products = useProducts(companyId, {
      supplier,
      category: null,
      q,
      page: 1,
    });
    const supplierName = useMemo(
      () => new Map((suppliers.data ?? []).map((s) => [s.id, s.name])),
      [suppliers.data],
    );

    function pick(product: LibraryProduct) {
      onPick({
        supplierId: product.supplier_id,
        supplierName: supplierName.get(product.supplier_id) ?? "",
        productId: product.id,
        productName: product.name,
        productUrl: product.product_url,
        suggestedPrice:
          product.last_unit_price == null
            ? null
            : String(Number(product.last_unit_price)),
      });
    }

    return (
      <Sheet
        ref={ref}
        title={t("chiffrage.pickFromLibrary")}
        snapPoints={["80%"]}
      >
        <View className="p-4">
          {!companyId ? (
            <EmptyState message={t("billing.form.noCompanies")} />
          ) : null}
          <Select
            testID="library-pick-supplier"
            value={supplier ?? "__all__"}
            options={[
              { value: "__all__", label: t("library.allSuppliers") },
              ...(suppliers.data ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              })),
            ]}
            onChange={(v) => setSupplier(v === "__all__" ? null : v)}
          />
          <TextInput
            testID="library-pick-search"
            className="mb-3 rounded-lg border border-border px-4 py-2 text-base text-primary"
            placeholder={t("chiffrage.librarySearch")}
            placeholderTextColor="#a3a3a3"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {products.isFetching ? <ActivityIndicator /> : null}
          {products.data && products.data.items.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              {t("chiffrage.libraryNone")}
            </Text>
          ) : null}
          {(products.data?.items ?? []).map((product) => (
            <Pressable
              key={product.id}
              testID={`library-pick-${product.id}`}
              onPress={() => pick(product)}
              className="border-b border-border py-2"
            >
              <Text className="text-base text-primary">{product.name}</Text>
              <Text className="text-xs text-muted-foreground">
                {supplierName.get(product.supplier_id) ?? ""} ·{" "}
                {product.supplier_reference}
                {product.last_unit_price != null
                  ? ` · ${formatMoney(product.last_unit_price)} HT`
                  : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    );
  },
);
