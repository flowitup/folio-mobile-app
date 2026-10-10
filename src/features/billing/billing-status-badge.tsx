import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/primitives";
import {
  statusLabelKey,
  statusTone,
} from "@/lib/billing/billing-status-transitions";

import type {
  BillingDocumentKind,
  BillingDocumentStatus,
} from "./billing-types";

export function BillingStatusBadge({
  kind,
  status,
}: {
  kind: BillingDocumentKind;
  status: BillingDocumentStatus;
}) {
  const { t } = useTranslation();
  return (
    <Badge
      label={t(`billing.status.${statusLabelKey(kind, status)}`)}
      tone={statusTone(status)}
    />
  );
}
