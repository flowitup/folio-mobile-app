import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import type { PickedFile } from "@/lib/files/pick";
import { uploadMultipart } from "@/lib/files/upload";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageQuote,
  ChiffrageRoom,
  ChiffrageStore,
  ChiffrageTree,
  ChiffrageUnit,
} from "./chiffrage-types";

export type PostePayload = { name: string; note?: string | null };
export type ArticlePayload = {
  name: string;
  quantity: number;
  unit?: string | null;
  room_id?: string | null;
  note?: string | null;
};
export type QuotePayload = {
  unit_price_ht: number;
  tva_rate?: number;
  store_id?: string | null;
  supplier_name?: string | null;
  library_product_id?: string | null;
  product_url?: string | null;
  note?: string | null;
};
export type StorePayload = {
  name: string;
  address?: string | null;
  website_url?: string | null;
};

export const chiffrageKeys = {
  tree: (p: string) => ["projects", p, "chiffrage"] as const,
  units: (p: string) => ["projects", p, "chiffrage", "units"] as const,
  rooms: (p: string) => ["projects", p, "chiffrage", "rooms"] as const,
};

const base = "/api/v1/projects/{project_id}/chiffrage" as const;

export function useChiffrage(projectId: string) {
  return useQuery({
    queryKey: chiffrageKeys.tree(projectId),
    enabled: Boolean(projectId),
    queryFn: async () =>
      unwrapAs<ChiffrageTree>(
        await api.GET(base, { params: { path: { project_id: projectId } } }),
      ),
  });
}

export function useChiffrageUnits(projectId: string) {
  return useQuery({
    queryKey: chiffrageKeys.units(projectId),
    enabled: Boolean(projectId),
    queryFn: async () =>
      unwrapAs<ChiffrageUnit[]>(
        await api.GET(`${base}/units`, {
          params: { path: { project_id: projectId } },
        }),
      ),
  });
}

/** One mutation factory keeps the 20 chiffrage endpoints uniform: every write invalidates the tree. */
function useChiffrageMutation<TVariables, TData = unknown>(
  projectId: string,
  run: (variables: TVariables) => Promise<TData>,
  message?: string,
) {
  return useApiMutation<TVariables, TData>({
    mutationFn: run,
    invalidates: [
      chiffrageKeys.tree(projectId),
      chiffrageKeys.units(projectId),
      chiffrageKeys.rooms(projectId),
      ["projects", projectId],
    ],
    successMessage: message,
  });
}

const path = (projectId: string) => ({
  params: { path: { project_id: projectId } },
});

export function useChiffrageActions(projectId: string) {
  const { t } = useTranslation();
  const saved = t("common.saved");
  const p = path(projectId);
  // Generic so openapi-fetch keeps the exact path-param keys (article_id, quote_id…).
  const withId = <T extends Record<string, string>>(extra: T) => ({
    params: { path: { project_id: projectId, ...extra } },
  });

  return {
    createUnit: useChiffrageMutation<{ symbol: string }, ChiffrageUnit>(
      projectId,
      async ({ symbol }) =>
        unwrapAs<ChiffrageUnit>(
          await api.POST(`${base}/units`, { ...p, body: { symbol } as never }),
        ),
      saved,
    ),
    deleteUnit: useChiffrageMutation<{ unitId: string }>(
      projectId,
      async ({ unitId }) =>
        unwrapVoid(
          await api.DELETE(
            `${base}/units/{unit_id}`,
            withId({ unit_id: unitId }),
          ),
        ),
    ),
    createRoom: useChiffrageMutation<{ name: string }, ChiffrageRoom>(
      projectId,
      async ({ name }) =>
        unwrapAs<ChiffrageRoom>(
          await api.POST(`${base}/rooms`, { ...p, body: { name } as never }),
        ),
      saved,
    ),
    updateRoom: useChiffrageMutation<
      { roomId: string; name: string },
      ChiffrageRoom
    >(
      projectId,
      async ({ roomId, name }) =>
        unwrapAs<ChiffrageRoom>(
          await api.PATCH(`${base}/rooms/{room_id}`, {
            ...withId({ room_id: roomId }),
            body: { name } as never,
          }),
        ),
      saved,
    ),
    deleteRoom: useChiffrageMutation<{ roomId: string }>(
      projectId,
      async ({ roomId }) =>
        unwrapVoid(
          await api.DELETE(
            `${base}/rooms/{room_id}`,
            withId({ room_id: roomId }),
          ),
        ),
    ),
    createStore: useChiffrageMutation<StorePayload, ChiffrageStore>(
      projectId,
      async (body) =>
        unwrapAs<ChiffrageStore>(
          await api.POST(`${base}/stores`, { ...p, body: body as never }),
        ),
      saved,
    ),
    updateStore: useChiffrageMutation<
      { storeId: string } & Partial<StorePayload>,
      ChiffrageStore
    >(
      projectId,
      async ({ storeId, ...body }) =>
        unwrapAs<ChiffrageStore>(
          await api.PATCH(`${base}/stores/{store_id}`, {
            ...withId({ store_id: storeId }),
            body: body as never,
          }),
        ),
      saved,
    ),
    deleteStore: useChiffrageMutation<{ storeId: string }>(
      projectId,
      async ({ storeId }) =>
        unwrapVoid(
          await api.DELETE(
            `${base}/stores/{store_id}`,
            withId({ store_id: storeId }),
          ),
        ),
    ),
    createPoste: useChiffrageMutation<PostePayload, ChiffragePoste>(
      projectId,
      async (body) =>
        unwrapAs<ChiffragePoste>(
          await api.POST(`${base}/postes`, { ...p, body: body as never }),
        ),
      saved,
    ),
    updatePoste: useChiffrageMutation<
      { posteId: string } & Partial<PostePayload>,
      ChiffragePoste
    >(
      projectId,
      async ({ posteId, ...body }) =>
        unwrapAs<ChiffragePoste>(
          await api.PATCH(`${base}/postes/{poste_id}`, {
            ...withId({ poste_id: posteId }),
            body: body as never,
          }),
        ),
      saved,
    ),
    deletePoste: useChiffrageMutation<{ posteId: string }>(
      projectId,
      async ({ posteId }) =>
        unwrapVoid(
          await api.DELETE(
            `${base}/postes/{poste_id}`,
            withId({ poste_id: posteId }),
          ),
        ),
    ),
    reorderPoste: useChiffrageMutation<{
      posteId: string;
      beforeId?: string | null;
      afterId?: string | null;
    }>(projectId, async ({ posteId, beforeId, afterId }) =>
      unwrapAs<unknown>(
        await api.POST(`${base}/postes/{poste_id}/reorder`, {
          ...withId({ poste_id: posteId }),
          body: {
            before_id: beforeId ?? null,
            after_id: afterId ?? null,
          } as never,
        }),
      ),
    ),
    createStoreForPoste: useChiffrageMutation<
      { posteId: string } & StorePayload,
      ChiffrageStore
    >(
      projectId,
      async ({ posteId, ...body }) =>
        unwrapAs<ChiffrageStore>(
          await api.POST(`${base}/postes/{poste_id}/stores`, {
            ...withId({ poste_id: posteId }),
            body: body as never,
          }),
        ),
      saved,
    ),
    createArticle: useChiffrageMutation<
      { posteId: string } & ArticlePayload,
      ChiffrageArticle
    >(
      projectId,
      async ({ posteId, ...body }) =>
        unwrapAs<ChiffrageArticle>(
          await api.POST(`${base}/postes/{poste_id}/articles`, {
            ...withId({ poste_id: posteId }),
            body: body as never,
          }),
        ),
      saved,
    ),
    updateArticle: useChiffrageMutation<
      { articleId: string } & Partial<ArticlePayload>,
      ChiffrageArticle
    >(
      projectId,
      async ({ articleId, ...body }) =>
        unwrapAs<ChiffrageArticle>(
          await api.PATCH(`${base}/articles/{article_id}`, {
            ...withId({ article_id: articleId }),
            body: body as never,
          }),
        ),
      saved,
    ),
    deleteArticle: useChiffrageMutation<{ articleId: string }>(
      projectId,
      async ({ articleId }) =>
        unwrapVoid(
          await api.DELETE(
            `${base}/articles/{article_id}`,
            withId({ article_id: articleId }),
          ),
        ),
    ),
    reorderArticle: useChiffrageMutation<{
      articleId: string;
      beforeId?: string | null;
      afterId?: string | null;
    }>(projectId, async ({ articleId, beforeId, afterId }) =>
      unwrapAs<unknown>(
        await api.POST(`${base}/articles/{article_id}/reorder`, {
          ...withId({ article_id: articleId }),
          body: {
            before_id: beforeId ?? null,
            after_id: afterId ?? null,
          } as never,
        }),
      ),
    ),
    uploadArticleImage: useChiffrageMutation<{
      articleId: string;
      file: PickedFile;
    }>(
      projectId,
      ({ articleId, file }) =>
        uploadMultipart(
          `/api/v1/projects/${encodeURIComponent(projectId)}/chiffrage/articles/${encodeURIComponent(articleId)}/image`,
          [{ field: "image", file }],
        ),
      saved,
    ),
    setArticleImageFromUrl: useChiffrageMutation<{
      articleId: string;
      url: string;
    }>(
      projectId,
      async ({ articleId, url }) =>
        unwrapAs<unknown>(
          await api.POST(`${base}/articles/{article_id}/image-from-url`, {
            ...withId({ article_id: articleId }),
            body: { url } as never,
          }),
        ),
      saved,
    ),
    deleteArticleImage: useChiffrageMutation<{ articleId: string }>(
      projectId,
      async ({ articleId }) =>
        unwrapVoid(
          await api.DELETE(
            `${base}/articles/{article_id}/image`,
            withId({ article_id: articleId }),
          ),
        ),
    ),
    createQuote: useChiffrageMutation<
      { articleId: string } & QuotePayload,
      ChiffrageQuote
    >(
      projectId,
      async ({ articleId, ...body }) =>
        unwrapAs<ChiffrageQuote>(
          await api.POST(`${base}/articles/{article_id}/quotes`, {
            ...withId({ article_id: articleId }),
            body: body as never,
          }),
        ),
      saved,
    ),
    updateQuote: useChiffrageMutation<
      { quoteId: string } & Partial<QuotePayload>,
      ChiffrageQuote
    >(
      projectId,
      async ({ quoteId, ...body }) =>
        unwrapAs<ChiffrageQuote>(
          await api.PATCH(`${base}/quotes/{quote_id}`, {
            ...withId({ quote_id: quoteId }),
            body: body as never,
          }),
        ),
      saved,
    ),
    deleteQuote: useChiffrageMutation<{ quoteId: string }>(
      projectId,
      async ({ quoteId }) =>
        unwrapVoid(
          await api.DELETE(
            `${base}/quotes/{quote_id}`,
            withId({ quote_id: quoteId }),
          ),
        ),
    ),
    selectQuote: useChiffrageMutation<{ quoteId: string }, ChiffrageQuote>(
      projectId,
      async ({ quoteId }) =>
        unwrapAs<ChiffrageQuote>(
          await api.POST(
            `${base}/quotes/{quote_id}/select`,
            withId({ quote_id: quoteId }),
          ),
        ),
      saved,
    ),
  };
}

/** API path of an article image (article-owned or library product), for `AuthedImage`. */
export function articleImagePath(
  projectId: string,
  article: ChiffrageArticle,
): string | null {
  if (!article.image_ref) return null;
  return article.image_ref.kind === "library"
    ? `/api/v1/bibliotheque/products/${encodeURIComponent(article.image_ref.id)}/image`
    : `/api/v1/projects/${encodeURIComponent(projectId)}/chiffrage/articles/${encodeURIComponent(article.id)}/image`;
}
