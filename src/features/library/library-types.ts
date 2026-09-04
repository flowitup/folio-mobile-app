/** Product library types — field names mirror the backend LibraryProductResponse / SupplierResponse. */

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  website_url: string | null;
  logo_url: string | null;
  product_url_template: string | null;
  created_at: string;
}

export interface LibraryProduct {
  id: string;
  company_id: string;
  supplier_id: string;
  supplier_reference: string;
  name: string;
  description: string | null;
  size: string | null;
  category: string | null;
  has_image: boolean;
  product_url: string | null;
  purchase_count: number;
  total_quantity: string;
  last_unit_price: string | null;
  first_purchased_at: string | null;
  last_purchased_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryPurchase {
  product_id: string;
  source_document_ref: string;
  source_document_type: "ticket" | "commande";
  line_index: number;
  purchased_at: string;
  quantity: string;
  unit_price: string;
}

export interface ProductListResult {
  items: LibraryProduct[];
  total: number;
  page: number;
}

export interface ProductDetailResult {
  product: LibraryProduct;
  purchases: LibraryPurchase[];
}

export interface CreateProductPayload {
  name: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_website_url?: string | null;
  supplier_reference?: string | null;
  category?: string | null;
  description?: string | null;
  size?: string | null;
  product_url?: string | null;
}

export interface UpdateProductPayload {
  name?: string;
  category?: string | null;
  description?: string | null;
  size?: string | null;
  product_url?: string | null;
}

/** One purchase line of a library import (POST /bibliotheque/import). */
export interface ImportRecord {
  supplier_reference: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  purchased_at: string;
  source_document_ref: string;
  source_document_type: "ticket" | "commande";
  line_index: number;
  size?: string | null;
  category?: string | null;
  product_url?: string | null;
  description?: string | null;
}

export interface ImportPayload {
  company_id: string;
  supplier_name: string;
  supplier_slug: string;
  supplier_website_url?: string | null;
  supplier_product_url_template?: string | null;
  records: ImportRecord[];
}

export interface ImportResult {
  created: number;
  updated: number;
  purchases_added: number;
  skipped: number;
}

/** Canonical category slugs; order drives the filter list (labels in i18n `library.categories.*`). */
export const LIBRARY_CATEGORY_SLUGS = [
  "terrasse_jardin",
  "revetement_sol_mur_peinture",
  "chauffage_clim_ventilation",
  "salle_de_bains",
  "meuble_rangement",
  "cuisine",
  "luminaire",
  "decoration",
  "menuiserie",
  "materiaux_construction",
  "electricite_domotique",
  "outillage",
  "plomberie",
  "quincaillerie",
  "droguerie",
  "autre",
] as const;

export type LibraryCategorySlug = (typeof LIBRARY_CATEGORY_SLUGS)[number];

export function isLibraryCategorySlug(
  value: string,
): value is LibraryCategorySlug {
  return (LIBRARY_CATEGORY_SLUGS as readonly string[]).includes(value);
}
