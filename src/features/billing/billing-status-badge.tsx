import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/primitives";
import { statusTone } from "@/lib/billing/billing-status-transitions";

import type { BillingDocumentStatus } from "./billing-types";

export function BillingStatusBadge({
  status,
}: {
  status: BillingDocumentStatus;
}) {
  const { t } = useTranslation();
  return (
    <Badge label={t(`billing.status.${status}`)} tone={statusTone(status)} />
  );
}
