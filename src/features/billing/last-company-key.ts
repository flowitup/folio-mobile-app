import type { BillingDocumentKind } from "./billing-types";

/** SecureStore key of the issuing company last used for a document kind. */
export const lastCompanyKey = (kind: BillingDocumentKind) =>
  `folio.billing.lastCompany.${kind}`;

/** Every such key, so sign-out can forget the leaving account's choice. */
export const LAST_COMPANY_KEYS = (["devis", "facture"] as const).map(
  lastCompanyKey,
);
