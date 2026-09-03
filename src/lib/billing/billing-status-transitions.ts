import type {
  BillingDocumentKind,
  BillingDocumentStatus,
} from "@/features/billing/billing-types";

/** Status filter values per kind (same lists as the web list pages). */
export const STATUSES_BY_KIND: Record<
  BillingDocumentKind,
  BillingDocumentStatus[]
> = {
  devis: ["draft", "sent", "accepted", "rejected", "expired"],
  facture: ["draft", "sent", "paid", "overdue", "cancelled"],
};

// Mirrors the server matrix in domain/billing/status.py; the API still enforces it.
const DEVIS: Partial<Record<BillingDocumentStatus, BillingDocumentStatus[]>> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: ["sent"],
  rejected: ["draft"],
};
const FACTURE: Partial<Record<BillingDocumentStatus, BillingDocumentStatus[]>> =
  {
    draft: ["sent"],
    sent: ["paid", "overdue", "cancelled"],
    overdue: ["paid"],
    paid: ["cancelled"],
  };

export function allowedTransitions(
  kind: BillingDocumentKind,
  status: BillingDocumentStatus,
): BillingDocumentStatus[] {
  return (kind === "devis" ? DEVIS : FACTURE)[status] ?? [];
}

/** i18n key suffix (under `billing.transitions`) for a from → to move. */
export function transitionLabelKey(
  kind: BillingDocumentKind,
  from: BillingDocumentStatus,
  to: BillingDocumentStatus,
): string {
  if (kind === "devis") {
    if (from === "accepted" && to === "sent") return "revertToSent";
    if (from === "rejected" && to === "draft") return "reopen";
  } else if (from === "paid" && to === "cancelled")
    return "markAsCancelledRefund";
  return `markAs${to.charAt(0).toUpperCase()}${to.slice(1)}`;
}

export type StatusTone = "neutral" | "success" | "warning" | "danger";

export function statusTone(status: BillingDocumentStatus): StatusTone {
  switch (status) {
    case "accepted":
    case "paid":
      return "success";
    case "rejected":
    case "overdue":
      return "danger";
    case "expired":
      return "warning";
    default:
      return "neutral";
  }
}
