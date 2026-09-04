import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import { pickImages } from "@/lib/files/pick";
import type { PickedFile } from "@/lib/files/pick";

import { LIBRARY_CATEGORY_SLUGS } from "./library-types";
import type {
  CreateProductPayload,
  LibraryProduct,
  Supplier,
  UpdateProductPayload,
} from "./library-types";

type SupplierMode = "existing" | "new";

type Props = {
  suppliers: Supplier[];
  initial?: LibraryProduct;
  submitting: boolean;
  /** Create: full payload + optional image. Edit: diff-only payload + optional replacement image. */
  onSubmit: (
    payload: CreateProductPayload | UpdateProductPayload,
    image: PickedFile | null,
  ) => void;
};

const orNull = (value: string) => value.trim() || null;

/** Create / edit product form. Edit sends only changed keys (empty string clears a field). */
export const ProductFormSheet = forwardRef<BottomSheetModal, Props>(
  function ProductFormSheet({ suppliers, initial, submitting, onSubmit }, ref) {
    const { t } = useTranslation();
    const editing = Boolean(initial);
    const [mode, setMode] = useState<SupplierMode>(
      suppliers.length > 0 ? "existing" : "new",
    );
    const [supplierId, setSupplierId] = useState<string | null>(
      suppliers[0]?.id ?? null,
    );
    const [supplierName, setSupplierName] = useState("");
    const [supplierWebsite, setSupplierWebsite] = useState("");
    const [name, setName] = useState(initial?.name ?? "");
    const [reference, setReference] = useState("");
    const [category, setCategory] = useState<string>(
      initial?.category ?? "__none__",
    );
    const [size, setSize] = useState(initial?.size ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [productUrl, setProductUrl] = useState(initial?.product_url ?? "");
    const [image, setImage] = useState<PickedFile | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    function submit() {
      const next: Record<string, string> = {};
      if (!name.trim()) next.name = t("library.validation.nameRequired");
      if (!editing) {
        if (mode === "existing" && !supplierId)
          next.supplier = t("library.validation.supplierRequired");
        if (mode === "new" && !supplierName.trim())
          next.supplier = t("library.validation.supplierRequired");
      }
      setErrors(next);
      if (Object.keys(next).length > 0) return;
      const categoryValue = category === "__none__" ? null : category;
      if (!initial) {
        onSubmit(
          {
            name: name.trim(),
            ...(mode === "existing"
              ? { supplier_id: supplierId! }
              : {
                  supplier_name: supplierName.trim(),
                  supplier_website_url: orNull(supplierWebsite),
                }),
            supplier_reference: orNull(reference),
            category: categoryValue,
            description: orNull(description),
            size: orNull(size),
            product_url: orNull(productUrl),
          },
          image,
        );
        return;
      }
      const diff: UpdateProductPayload = {};
      if (name.trim() !== initial.name) diff.name = name.trim();
      if (categoryValue !== initial.category) diff.category = categoryValue;
      if (orNull(description) !== initial.description)
        diff.description = orNull(description);
      if (orNull(size) !== initial.size) diff.size = orNull(size);
      if (orNull(productUrl) !== initial.product_url)
        diff.product_url = orNull(productUrl);
      onSubmit(diff, image);
    }

    async function pick() {
      const result = await pickImages(false);
      if (result.status === "denied")
        return showToast(t("invoices.attachments.permissionDenied"), "error");
      if (result.status === "picked") setImage(result.files[0]);
    }

    return (
      <Sheet
        ref={ref}
        title={editing ? t("library.editTitle") : t("library.createTitle")}
        snapPoints={["90%"]}
      >
        <View className="p-4">
          {!editing ? (
            <>
              <View className="mb-3 flex-row gap-2">
                {(["existing", "new"] as const).map((value) => (
                  <Pressable
                    key={value}
                    testID={`supplier-mode-${value}`}
                    disabled={value === "existing" && suppliers.length === 0}
                    onPress={() => setMode(value)}
                    className={`rounded-full border px-3 py-1 ${mode === value ? "border-primary bg-primary" : "border-border"}`}
                  >
                    <Text
                      className={
                        mode === value
                          ? "text-primary-foreground"
                          : "text-primary"
                      }
                    >
                      {t(`library.supplierMode.${value}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {mode === "existing" ? (
                <Select
                  testID="product-supplier"
                  label={t("library.supplier")}
                  value={supplierId}
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  onChange={setSupplierId}
                  error={errors.supplier}
                />
              ) : (
                <>
                  <Input
                    testID="product-supplier-name"
                    label={t("library.fields.supplierName")}
                    value={supplierName}
                    onChangeText={setSupplierName}
                    error={errors.supplier}
                  />
                  <Input
                    testID="product-supplier-website"
                    label={t("library.fields.supplierWebsite")}
                    value={supplierWebsite}
                    onChangeText={setSupplierWebsite}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </>
              )}
            </>
          ) : (
            <Text className="mb-3 text-xs text-muted-foreground">
              {t("library.reference")} {initial?.supplier_reference}
            </Text>
          )}
          <Input
            testID="product-name"
            label={t("library.fields.name")}
            value={name}
            onChangeText={setName}
            error={errors.name}
          />
          {!editing ? (
            <Input
              testID="product-reference"
              label={t("library.fields.reference")}
              value={reference}
              onChangeText={setReference}
              hint={t("library.fields.referenceHint")}
              autoCapitalize="characters"
            />
          ) : null}
          <Select
            testID="product-category"
            label={t("library.fields.category")}
            value={category}
            options={[
              { value: "__none__", label: t("library.uncategorizedOption") },
              ...LIBRARY_CATEGORY_SLUGS.map((slug) => ({
                value: slug,
                label: t(`library.categories.${slug}`),
              })),
            ]}
            onChange={setCategory}
          />
          <Input
            testID="product-size"
            label={t("library.fields.size")}
            value={size}
            onChangeText={setSize}
          />
          <Input
            testID="product-description"
            label={t("library.fields.description")}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Input
            testID="product-url"
            label={t("library.fields.productUrl")}
            value={productUrl}
            onChangeText={setProductUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://"
          />
          <Button
            testID="product-image"
            label={
              image
                ? image.name
                : editing && initial?.has_image
                  ? t("library.fields.replaceImage")
                  : t("library.pickImage")
            }
            variant="secondary"
            className="mb-4"
            onPress={() => void pick()}
          />
          <Text className="mb-3 text-xs text-muted-foreground">
            {t("library.fields.imageHint")}
          </Text>
          <Button
            testID="product-submit"
            label={editing ? t("common.save") : t("library.actions.create")}
            loading={submitting}
            onPress={submit}
          />
        </View>
      </Sheet>
    );
  },
);
