import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import type { PickedFile } from "@/lib/files/pick";
import { uploadMultipart } from "@/lib/files/upload";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type {
  CreateProductPayload,
  ImportPayload,
  ImportResult,
  LibraryProduct,
  ProductDetailResult,
  ProductListResult,
  Supplier,
  UpdateProductPayload,
} from "./library-types";

export type ProductFilters = {
  supplier: string | null;
  category: string | null;
  q: string;
  page: number;
};

export const libraryKeys = {
  all: ["library"] as const,
  suppliers: (companyId: string) =>
    ["library", "suppliers", companyId] as const,
  categories: (companyId: string) =>
    ["library", "categories", companyId] as const,
  products: (companyId: string, filters: ProductFilters) =>
    ["library", "products", companyId, filters] as const,
  detail: (id: string) => ["library", "product", id] as const,
};

const base = "/api/v1/bibliotheque" as const;

export function useSuppliers(companyId: string | null) {
  return useQuery({
    queryKey: libraryKeys.suppliers(companyId ?? ""),
    enabled: Boolean(companyId),
    queryFn: async () =>
      unwrapAs<{ items: Supplier[] }>(
        await api.GET(`${base}/suppliers`, {
          params: { query: { company_id: companyId } } as never,
        }),
      ).items,
  });
}

/** Distinct category slugs in use for the company (the filter only offers these). */
export function useLibraryCategories(companyId: string | null) {
  return useQuery({
    queryKey: libraryKeys.categories(companyId ?? ""),
    enabled: Boolean(companyId),
    queryFn: async () =>
      unwrapAs<{ items: string[] }>(
        await api.GET(`${base}/categories`, {
          params: { query: { company_id: companyId } } as never,
        }),
      ).items,
  });
}

export function useProducts(companyId: string | null, filters: ProductFilters) {
  return useQuery({
    queryKey: libraryKeys.products(companyId ?? "", filters),
    enabled: Boolean(companyId),
    placeholderData: (previous) => previous,
    queryFn: async () =>
      unwrapAs<ProductListResult>(
        await api.GET(`${base}/products`, {
          params: {
            query: {
              company_id: companyId,
              ...(filters.supplier ? { supplier: filters.supplier } : {}),
              ...(filters.category ? { category: filters.category } : {}),
              ...(filters.q ? { q: filters.q } : {}),
              page: filters.page,
            },
          } as never,
        }),
      ),
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: libraryKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () =>
      unwrapAs<ProductDetailResult>(
        await api.GET(`${base}/products/{product_id}`, {
          params: { path: { product_id: id! } },
        }),
      ),
  });
}

export function useCreateProduct(companyId: string | null) {
  const { t } = useTranslation();
  return useApiMutation<CreateProductPayload, LibraryProduct>({
    mutationFn: async (body) =>
      unwrapAs<LibraryProduct>(
        await api.POST(`${base}/products`, {
          body: { company_id: companyId, ...body } as never,
        }),
      ),
    invalidates: [libraryKeys.all],
    successMessage: t("library.toast.created"),
  });
}

export function useUpdateProduct() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string } & UpdateProductPayload, LibraryProduct>({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<LibraryProduct>(
        await api.PATCH(`${base}/products/{product_id}`, {
          params: { path: { product_id: id } },
          body: body as never,
        }),
      ),
    invalidates: [libraryKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useDeleteProduct() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE(`${base}/products/{product_id}`, {
          params: { path: { product_id: id } },
        }),
      ),
    invalidates: [libraryKeys.all],
    successMessage: t("library.toast.deleted"),
  });
}

/** Multipart upload (field `image`, jpeg / png / webp ≤ 10 MB); `force` replaces an existing image. */
export function useUploadProductImage() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string; file: PickedFile; force?: boolean }>({
    mutationFn: ({ id, file, force }) =>
      uploadMultipart(
        `${base}/products/${encodeURIComponent(id)}/image${force ? "?force=true" : ""}`,
        [{ field: "image", file }],
      ),
    invalidates: [libraryKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useProductImageFromUrl() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string; url: string; force?: boolean }>({
    mutationFn: async ({ id, url, force }) =>
      unwrapAs<unknown>(
        await api.POST(`${base}/products/{product_id}/image-from-url`, {
          params: {
            path: { product_id: id },
            query: force ? { force: "true" } : {},
          } as never,
          body: { url } as never,
        }),
      ),
    invalidates: [libraryKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useImportLibrary() {
  return useApiMutation<ImportPayload, ImportResult>({
    mutationFn: async (body) =>
      unwrapAs<ImportResult>(
        await api.POST(`${base}/import`, { body: body as never }),
      ),
    invalidates: [libraryKeys.all],
  });
}

export const productImagePath = (id: string) =>
  `${base}/products/${encodeURIComponent(id)}/image`;
