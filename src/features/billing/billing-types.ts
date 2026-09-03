/**
 * Billing domain types (devis / facture), copied from the web `types/billing.ts`.
 * Decimal values travel as strings; the server is authoritative for stored totals.
 */

export type BillingDocumentKind = "devis" | "facture";

export type BillingDocumentStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "paid"
  | "overdue"
  | "cancelled";

export interface BillingDocumentItem {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
  category?: string | null;
  /** Present on responses only (server-computed). */
  total_ht?: string;
  total_tva?: string;
  total_ttc?: string;
}

export interface VatBreakdownEntry {
  rate: string;
  base_ht: string;
  tva_amount: string;
}

export interface BillingDocument {
  id: string;
  user_id: string;
  company_id: string | null;
  project_id: string | null;
  kind: BillingDocumentKind;
  document_number: string;
  status: BillingDocumentStatus;
  issue_date: string;
  validity_until: string | null;
  payment_due_date: string | null;
  payment_terms: string | null;
  recipient_name: string;
  recipient_address: string | null;
  recipient_email: string | null;
  recipient_siret: string | null;
  notes: string | null;
  terms: string | null;
  signature_block_text: string | null;
  items: BillingDocumentItem[];
  issuer_legal_name: string;
  issuer_address: string;
  issuer_siret: string | null;
  issuer_tva_number: string | null;
  issuer_iban: string | null;
  issuer_bic: string | null;
  issuer_logo_url: string | null;
  source_devis_id: string | null;
  total_ht: string;
  total_tva: string;
  total_ttc: string;
  vat_breakdown?: VatBreakdownEntry[];
  created_at: string;
  updated_at: string;
}

export interface BillingDocumentTemplate {
  id: string;
  user_id: string;
  kind: BillingDocumentKind;
  name: string;
  notes: string | null;
  terms: string | null;
  default_vat_rate: string | null;
  items: BillingDocumentItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateBillingDocumentPayload {
  kind: BillingDocumentKind;
  company_id: string;
  project_id?: string | null;
  recipient_name: string;
  recipient_address?: string | null;
  recipient_email?: string | null;
  recipient_siret?: string | null;
  items: BillingDocumentItem[];
  notes?: string | null;
  terms?: string | null;
  signature_block_text?: string | null;
  validity_until?: string | null;
  payment_due_date?: string | null;
  payment_terms?: string | null;
  issue_date?: string | null;
}

export type UpdateBillingDocumentPayload = Partial<
  Omit<CreateBillingDocumentPayload, "kind" | "company_id">
>;

/** Historical document with a pre-supplied number (POST /billing-documents/import). */
export type ImportBillingDocumentPayload = CreateBillingDocumentPayload & {
  document_number: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  created_at?: string | null;
};

export const IMPORT_STATUSES: ImportBillingDocumentPayload["status"][] = [
  "draft",
  "sent",
  "paid",
  "cancelled",
];

export interface CloneBillingDocumentPayload {
  override_kind?: BillingDocumentKind | null;
  company_id?: string | null;
}

export interface ConvertDevisToFacturePayload {
  payment_due_date?: string | null;
  payment_terms?: string | null;
  company_id?: string | null;
}

export interface ApplyTemplatePayload {
  recipient_name: string;
  recipient_address?: string | null;
  recipient_email?: string | null;
  recipient_siret?: string | null;
  project_id?: string | null;
  issue_date?: string | null;
  company_id?: string | null;
}

export interface CreateBillingTemplatePayload {
  kind: BillingDocumentKind;
  name: string;
  items: BillingDocumentItem[];
  notes?: string | null;
  terms?: string | null;
  default_vat_rate?: string | null;
}

export type UpdateBillingTemplatePayload = Partial<
  Omit<CreateBillingTemplatePayload, "kind">
>;

export interface ActivityCategory {
  name: string;
  frequency: number;
}

export interface ActivitySuggestion {
  description: string;
  category: string | null;
  frequency: number;
  last_unit: string | null;
  last_unit_price: string;
  last_vat_rate: string;
}

export interface ActivitySuggestionsResponse {
  categories: ActivityCategory[];
  suggestions: ActivitySuggestion[];
}

/** Same VAT presets as the web items editor. */
export const VAT_PRESETS = ["20", "10", "5.5", "0"];
