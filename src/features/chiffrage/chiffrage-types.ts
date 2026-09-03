/**
 * Chiffrage API wrappers — server-only.
 *
 * Per-project material provisioning: postes -> articles -> supplier quotes.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client
 * components; those go through the server actions in the chiffrage route.
 *
 * Money arrives from the API already quantized to cents. Totals are computed
 * backend-side and must be rendered as given: recomputing them here would let
 * the displayed subtotal drift from the grand total.
 */

// ---------------------------------------------------------------------------
// Types — mirror the BE dataclass DTOs
// ---------------------------------------------------------------------------

/** How an article's effective price was resolved. */
export type EffectiveSource = "selected" | "cheapest" | "none";

export interface ChiffrageQuote {
  id: string;
  article_id: string;
  /** The project shop this price was recorded at — what makes it comparable. */
  store_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  library_product_id: string | null;
  unit_price_ht: number;
  tva_rate: number;
  unit_price_ttc: number;
  product_url: string | null;
  note: string | null;
  is_selected: boolean;
}

/** Which endpoint serves an article's thumbnail. */
export interface ChiffrageImageRef {
  kind: "article" | "library";
  id: string;
}

/** A room of the chantier, declared once and reused by every poste. */
export interface ChiffrageRoom {
  id: string;
  name: string;
  position: number;
}

/** What one room costs inside one poste. room_id null = unassigned. */
export interface ChiffrageRoomSubtotal {
  room_id: string | null;
  subtotal_ht: number;
  subtotal_ttc: number;
  article_count: number;
}

export interface ChiffrageArticle {
  id: string;
  poste_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  room_id: string | null;
  position: number;
  quotes: ChiffrageQuote[];
  image_ref: ChiffrageImageRef | null;
  effective_quote_id: string | null;
  effective_source: EffectiveSource;
  total_ht: number;
  total_ttc: number;
}

/** A shop to visit for a poste's purchases. */
export interface ChiffrageStore {
  id: string;
  project_id: string;
  name: string;
  address: string | null;
  website_url: string | null;
  position: number;
}

/**
 * What one shop would cost for a set of articles.
 *
 * `covers_all` is not decoration: a basket that skips the items a shop has no
 * price for makes the least complete shop look cheapest. Never present a
 * basket total without its coverage, and never mark a partial one as cheapest.
 */
export interface ChiffrageStoreBasket {
  store_id: string;
  basket_ht: number;
  basket_ttc: number;
  priced_article_count: number;
  total_article_count: number;
  missing_article_ids: string[];
  covers_all: boolean;
}

export interface ChiffragePoste {
  id: string;
  project_id: string;
  name: string;
  note: string | null;
  position: number;
  articles: ChiffrageArticle[];
  /** What each shop would cost for this section alone, best-covering first. */
  store_baskets: ChiffrageStoreBasket[];
  room_subtotals: ChiffrageRoomSubtotal[];
  subtotal_ht: number;
  subtotal_ttc: number;
}

export interface ChiffrageTree {
  project_id: string;
  postes: ChiffragePoste[];
  rooms: ChiffrageRoom[];
  /** The project's shops, declared once and shared by every section. */
  stores: ChiffrageStore[];
  /** What each shop would cost for the whole project, best-covering first. */
  store_baskets: ChiffrageStoreBasket[];
  total_ht: number;
  total_ttc: number;
  unpriced_article_count: number;
}

/** A selectable unit. Presets carry no id — they are a backend constant. */
export interface ChiffrageUnit {
  id: string | null;
  symbol: string;
  is_preset: boolean;
}

export interface PostePayload {
  name?: string;
  note?: string | null;
}

export interface StorePayload {
  name?: string;
  address?: string | null;
  website_url?: string | null;
}

export interface ArticlePayload {
  name?: string;
  quantity?: number | string;
  unit?: string | null;
  note?: string | null;
  room_id?: string | null;
}

export interface QuotePayload {
  unit_price_ht?: number | string;
  tva_rate?: number | string;
  store_id?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  library_product_id?: string | null;
  product_url?: string | null;
  note?: string | null;
}

export interface ReorderPayload {
  before_id?: string | null;
  after_id?: string | null;
}

// ---------------------------------------------------------------------------
// Internal error helper — mirrors notes.ts / bibliotheque.ts shape
// ---------------------------------------------------------------------------
