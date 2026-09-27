import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/auth/auth-context";
import { Sheet } from "@/components/ui/sheet";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";
import { MAX_BUDGET } from "@/lib/format/numeric-bounds";

import { projectCan } from "./projects-api";
import type { Project, UpdateProjectBody } from "./projects-api";

export type ProjectFormValues = {
  /** Site address — mandatory, it is what identifies the project everywhere. */
  address: string;
  /**
   * Optional label. Empty means "label the project by its address": the
   * backend stores the address as the name, so nothing ever renders blank.
   */
  name: string;
  /**
   * Financing side — present only when the caller holds `project:view_budget`.
   * Absent (not null) otherwise: the API refuses a PUT that carries a budget
   * the caller cannot read, and "absent" is how it is told to leave the stored
   * value alone, while null would mean "clear it".
   */
  budget?: number | null;
  budget_source?: string | null;
  invoice_prefix?: string | null;
  /** Create only: the company the new project belongs to, when the caller chose one. */
  company_id?: string;
};

/** A company the caller administers, in which a project can be created. */
export type ProjectFormCompany = {
  id: string;
  legal_name: string;
  is_primary?: boolean;
};

export type ProjectFormSheetHandle = { open: () => void; close: () => void };

/** The backend's invoice prefix rule: 1-8 letters or digits, stored upper-cased. */
const INVOICE_PREFIX = /^[A-Z0-9]{1,8}$/;

/**
 * Why a typed budget cannot be saved, or null when it can (blank means "no budget").
 * Unreadable text must not fall through as null: that would save the project without a
 * budget, or clear the stored one, with no word to the user.
 */
export function budgetProblem(text: string): "invalid" | "tooLarge" | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = parseMoneyInput(trimmed);
  if (value === null || value < 0) return "invalid";
  return value > MAX_BUDGET ? "tooLarge" : null;
}

/** True when a typed invoice prefix (blank clears it) passes the backend's rule. */
export function isValidInvoicePrefix(text: string): boolean {
  const cleaned = text.trim().toUpperCase();
  return cleaned === "" || INVOICE_PREFIX.test(cleaned);
}

type Props = {
  /** Existing project to edit; omit for create. */
  project?: Project;
  submitting: boolean;
  onSubmit: (values: ProjectFormValues) => void;
  /**
   * Create only: the companies the caller administers. With more than one the form asks
   * which the project belongs to (defaulting to the primary one), as the web dialog does.
   */
  companies?: ProjectFormCompany[];
};

function defaultCompanyId(companies: ProjectFormCompany[]): string | null {
  return (companies.find((c) => c.is_primary) ?? companies[0])?.id ?? null;
}

/**
 * The label the user chose, if any. A project labelled by its address (the
 * backend's fallback for a blank name stores the address, cut to the 255-char
 * name column) has no custom label, so its name field opens empty and stays
 * address-labelled when saved blank.
 */
export function customLabel(project: Pick<Project, "name" | "address">) {
  const addressLabel = (project.address ?? "").slice(0, 255);
  return addressLabel && project.name === addressLabel ? "" : project.name;
}

function toDraft(project?: Project) {
  return {
    address: project?.address ?? "",
    name: project ? customLabel(project) : "",
    budget: project?.budget != null ? String(project.budget) : "",
    budgetSource: project?.budget_source ?? "",
    invoicePrefix: project?.invoice_prefix ?? "",
  };
}

/** Create / edit project form in a bottom sheet — same fields as the web dialogs. */
export const ProjectFormSheet = forwardRef<ProjectFormSheetHandle, Props>(
  function ProjectFormSheet(
    { project, submitting, onSubmit, companies = [] },
    ref,
  ) {
    const { t } = useTranslation();
    const { user } = useAuth();
    // Editing an existing project: the financing fields need
    // `project:view_budget`. Creating one is already admin-only
    // (`project:create` is never customisable), so the fields always show there.
    const canViewBudget = project
      ? projectCan(project, "project:view_budget", user?.permissions)
      : true;
    const sheet = useRef<BottomSheetModal>(null);
    const [draft, setDraft] = useState(() => toDraft(project));
    const [addressError, setAddressError] = useState<string | null>(null);
    const [budgetError, setBudgetError] = useState<string | null>(null);
    const [prefixError, setPrefixError] = useState<string | null>(null);
    const pickCompany = !project && companies.length > 1;
    const [companyId, setCompanyId] = useState<string | null>(() =>
      defaultCompanyId(companies),
    );
    const [companyError, setCompanyError] = useState<string | null>(null);

    useEffect(() => setDraft(toDraft(project)), [project]);

    useImperativeHandle(ref, () => ({
      open: () => {
        setDraft(toDraft(project));
        setAddressError(null);
        setBudgetError(null);
        setPrefixError(null);
        setCompanyId(defaultCompanyId(companies));
        setCompanyError(null);
        sheet.current?.present();
      },
      close: () => sheet.current?.dismiss(),
    }));

    function submit() {
      const address = draft.address.trim();
      if (!address) return setAddressError(t("project.form.addressRequired"));
      if (pickCompany && !companyId)
        return setCompanyError(t("project.form.companyRequired"));
      const budgetText = draft.budget.trim();
      const problem = canViewBudget ? budgetProblem(budgetText) : null;
      if (problem === "invalid")
        return setBudgetError(t("project.form.budgetInvalid"));
      if (problem === "tooLarge")
        return setBudgetError(
          t("project.form.budgetTooLarge", { max: formatMoney(MAX_BUDGET) }),
        );
      if (project && !isValidInvoicePrefix(draft.invoicePrefix))
        return setPrefixError(t("project.form.invoicePrefixInvalid"));
      const values: ProjectFormValues = {
        address,
        name: draft.name.trim(),
        ...(canViewBudget
          ? {
              budget: budgetText ? parseMoneyInput(budgetText) : null,
              budget_source: draft.budgetSource.trim() || null,
            }
          : {}),
      };
      if (project) values.invoice_prefix = draft.invoicePrefix.trim() || null;
      if (pickCompany && companyId) values.company_id = companyId;
      onSubmit(values);
    }

    return (
      <Sheet
        ref={sheet}
        title={
          project ? t("project.form.editTitle") : t("project.form.createTitle")
        }
        snapPoints={["75%"]}
      >
        <View className="p-4">
          <Input
            testID="project-form-address"
            label={t("project.form.address")}
            value={draft.address}
            onChangeText={(address) => {
              setAddressError(null);
              setDraft({ ...draft, address });
            }}
            error={addressError}
            autoFocus
          />
          {pickCompany ? (
            <Select
              testID="project-form-company"
              label={t("project.form.company")}
              value={companyId}
              options={companies.map((c) => ({
                value: c.id,
                label: c.legal_name,
              }))}
              onChange={(value) => {
                setCompanyError(null);
                setCompanyId(value);
              }}
              error={companyError}
            />
          ) : null}
          <Input
            testID="project-form-name"
            label={t("project.form.nameOptional")}
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            placeholder={t("project.form.namePlaceholder")}
          />
          {canViewBudget ? (
            <>
              <Input
                testID="project-form-budget"
                label={t("project.form.budget")}
                value={draft.budget}
                onChangeText={(budget) => {
                  setBudgetError(null);
                  setDraft({ ...draft, budget });
                }}
                keyboardType="decimal-pad"
                error={budgetError}
                hint={
                  draft.budget
                    ? formatMoney(parseMoneyInput(draft.budget))
                    : undefined
                }
              />
              <Input
                testID="project-form-budget-source"
                label={t("project.form.budgetSource")}
                value={draft.budgetSource}
                onChangeText={(budgetSource) =>
                  setDraft({ ...draft, budgetSource })
                }
                hint={t("project.form.budgetSourceHint")}
              />
            </>
          ) : null}
          {project ? (
            <Input
              testID="project-form-invoice-prefix"
              label={t("project.form.invoicePrefix")}
              value={draft.invoicePrefix}
              onChangeText={(invoicePrefix) => {
                setPrefixError(null);
                setDraft({ ...draft, invoicePrefix });
              }}
              error={prefixError}
              hint={t("project.form.invoicePrefixHint")}
              autoCapitalize="characters"
              maxLength={8}
            />
          ) : null}
          <Button
            testID="project-form-submit"
            label={project ? t("common.save") : t("project.form.create")}
            loading={submitting}
            onPress={submit}
          />
        </View>
      </Sheet>
    );
  },
);

/** Maps form values to the PUT body; the API keeps fields absent from the body unchanged. */
export function toUpdateBody(values: ProjectFormValues): UpdateProjectBody {
  return {
    address: values.address,
    // An empty name tells the backend to label the project by its address again.
    name: values.name,
    // Spread rather than assign: a caller without `project:view_budget` sends
    // no budget key at all, and the API 403s a body that carries one.
    ...("budget" in values ? { budget: values.budget } : {}),
    ...("budget_source" in values
      ? { budget_source: values.budget_source }
      : {}),
    invoice_prefix: values.invoice_prefix ?? null,
  };
}
