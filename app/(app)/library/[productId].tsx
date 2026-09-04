import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AuthedImage } from "@/components/ui/authed-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, ErrorState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Sheet } from "@/components/ui/sheet";
import { showToast, ToastViewport } from "@/components/ui/toast";
import {
  productImagePath,
  useDeleteProduct,
  useProduct,
  useProductImageFromUrl,
  useSuppliers,
  useUpdateProduct,
  useUploadProductImage,
} from "@/features/library/library-api";
import { localizeCategory } from "@/features/library/library-helpers";
import type { UpdateProductPayload } from "@/features/library/library-types";
import { ProductFormSheet } from "@/features/library/product-form-sheet";
import { captureImage } from "@/lib/files/pick";
import type { PickedFile } from "@/lib/files/pick";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

/** Product detail: image, metadata, purchase history, edit sheet, image actions, typed-name delete. */
export default function LibraryProductScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const query = useProduct(productId);
  const product = query.data?.product;
  const suppliers = useSuppliers(product?.company_id ?? null);
  const update = useUpdateProduct();
  const remove = useDeleteProduct();
  const uploadImage = useUploadProductImage();
  const imageFromUrl = useProductImageFromUrl();
  const editSheet = useRef<BottomSheetModal>(null);
  const urlSheet = useRef<BottomSheetModal>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  if (query.isPending)
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title="…" back />
        <ActivityIndicator className="mt-8" />
      </View>
    );
  if (!product)
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title={t("library.detailTitle")} back />
        <ErrorState
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void query.refetch()}
        />
      </View>
    );

  const supplier = suppliers.data?.find((s) => s.id === product.supplier_id);
  const purchases = [...(query.data?.purchases ?? [])].sort((a, b) =>
    b.purchased_at.localeCompare(a.purchased_at),
  );

  function submitEdit(payload: UpdateProductPayload, image: PickedFile | null) {
    if (!product) return;
    const done = () => {
      editSheet.current?.dismiss();
      if (image)
        uploadImage.mutate(
          { id: product.id, file: image, force: true },
          {
            onError: () => {
              showToast(t("library.toast.imageUploadWarning"), "error");
              return true;
            },
          },
        );
    };
    if (Object.keys(payload).length > 0)
      update.mutate({ id: product.id, ...payload }, { onSuccess: done });
    else done();
  }

  async function takePhoto() {
    const result = await captureImage();
    if (result.status === "denied")
      return showToast(t("invoices.attachments.permissionDenied"), "error");
    if (result.status === "picked" && product)
      uploadImage.mutate({
        id: product.id,
        file: result.files[0],
        force: product.has_image,
      });
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={product.name}
        back
        right={
          <Button
            testID="product-edit"
            label={t("common.edit")}
            size="sm"
            onPress={() => editSheet.current?.present()}
          />
        }
      />
      <ScrollView contentContainerClassName="p-4 pb-12">
        <View className="aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
          {product.has_image ? (
            <AuthedImage
              key={product.updated_at}
              path={productImagePath(product.id)}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <Text className="text-4xl text-muted-foreground">▣</Text>
          )}
        </View>
        <View className="my-3 flex-row flex-wrap gap-2">
          <Button
            testID="product-photo"
            label={t("library.takePhoto")}
            size="sm"
            variant="secondary"
            loading={uploadImage.isPending}
            onPress={() => void takePhoto()}
          />
          <Button
            testID="product-image-url"
            label={t("library.imageFromUrl")}
            size="sm"
            variant="secondary"
            onPress={() => urlSheet.current?.present()}
          />
          <Button
            testID="product-delete"
            label={t("common.delete")}
            size="sm"
            variant="danger"
            onPress={() => {
              setConfirmName("");
              setDeleting(true);
            }}
          />
        </View>
        <Card className="mb-3">
          <Text className="text-xs text-muted-foreground">
            {t("library.supplier")}
          </Text>
          <Text className="text-base text-primary">
            {supplier?.name ?? product.supplier_id}
            {supplier?.website_url ? ` · ${supplier.website_url}` : ""}
          </Text>
          <Text className="mt-2 text-xs text-muted-foreground">
            {t("library.reference")}
          </Text>
          <Text className="text-base text-primary">
            {product.supplier_reference}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-1">
            <Badge
              label={localizeCategory(t, product.category)}
              tone={product.category ? "success" : "neutral"}
            />
            {product.size ? (
              <Badge label={product.size} tone="warning" />
            ) : null}
          </View>
          {product.product_url ? (
            <Pressable
              testID="product-open-url"
              onPress={() => void Linking.openURL(product.product_url!)}
              className="mt-2"
            >
              <Text className="text-sm text-primary underline">
                {t("library.viewProduct")}
              </Text>
            </Pressable>
          ) : null}
          {product.description ? (
            <Text className="mt-2 text-sm text-primary">
              {product.description}
            </Text>
          ) : null}
          <Text className="mt-2 text-xs text-muted-foreground">
            {t("library.purchasedTimes", { count: product.purchase_count })}
            {product.last_unit_price != null
              ? ` · ${t("library.lastUnitPrice")} ${formatMoney(product.last_unit_price)}`
              : ""}
          </Text>
        </Card>
        {purchases.length > 0 ? (
          <Card>
            <Text className="mb-2 text-base font-semibold text-primary">
              {t("library.purchaseHistory")}
            </Text>
            {purchases.map((purchase) => (
              <View
                key={`${purchase.source_document_ref}-${purchase.line_index}`}
                className="flex-row items-center justify-between border-t border-border py-2"
              >
                <View className="flex-1">
                  <Text className="text-sm text-primary">
                    {formatDate(purchase.purchased_at)} ·{" "}
                    {purchase.source_document_ref}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t(`library.documentType.${purchase.source_document_type}`)}{" "}
                    · {t("library.quantity")} {Number(purchase.quantity)}
                  </Text>
                </View>
                <Text className="text-sm text-primary">
                  {formatMoney(purchase.unit_price)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <ProductFormSheet
        key={product.updated_at}
        ref={editSheet}
        suppliers={suppliers.data ?? []}
        initial={product}
        submitting={update.isPending}
        onSubmit={(payload, image) => submitEdit(payload, image)}
      />

      <Sheet
        ref={urlSheet}
        title={t("library.imageFromUrl")}
        snapPoints={["40%"]}
      >
        <View className="p-4">
          <Input
            testID="image-url-input"
            label={t("library.imageUrl")}
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://"
          />
          <Button
            testID="image-url-submit"
            label={t("common.save")}
            loading={imageFromUrl.isPending}
            onPress={() =>
              imageFromUrl.mutate(
                {
                  id: product.id,
                  url: imageUrl.trim(),
                  force: product.has_image,
                },
                { onSuccess: () => urlSheet.current?.dismiss() },
              )
            }
          />
        </View>
      </Sheet>

      <Modal
        visible={deleting}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleting(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 p-6">
          <View className="w-full rounded-lg bg-white p-4">
            <Text className="mb-1 text-lg font-semibold text-primary">
              {t("library.deleteTitle")}
            </Text>
            <Text className="mb-3 text-sm text-primary">
              {t("library.deleteWarning", {
                name: product.name,
                count: product.purchase_count,
              })}
            </Text>
            <Input
              testID="delete-confirm-name"
              label={t("library.deleteConfirmLabel")}
              value={confirmName}
              onChangeText={setConfirmName}
              placeholder={product.name}
            />
            <View className="flex-row justify-end gap-2">
              <Button
                label={t("common.cancel")}
                variant="secondary"
                size="sm"
                onPress={() => setDeleting(false)}
              />
              <Button
                testID="delete-confirm"
                label={t("common.delete")}
                variant="danger"
                size="sm"
                disabled={confirmName.trim() !== product.name.trim()}
                loading={remove.isPending}
                onPress={() =>
                  remove.mutate(
                    { id: product.id },
                    {
                      onSuccess: () => {
                        setDeleting(false);
                        router.back();
                      },
                    },
                  )
                }
              />
            </View>
          </View>
          <ToastViewport />
        </View>
      </Modal>
    </View>
  );
}
