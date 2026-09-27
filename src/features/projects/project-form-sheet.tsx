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
import { useAuth } from "@/auth/auth-context";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import type { MyCompany } from "@/features/companies/companies-api";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";

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
  /**
   * Owning company — create only, and only when the caller administers more than
   * one. A single-company admin sends nothing and the API resolves the company
   * itself, the same split the web create dialog makes.
   */
  company_id?: string;
};

export type ProjectFormSheetHandle = { open: () => void; close: () => void };

type Props = {
  /** Existing project to edit; omit for create. */
  project?: Project;
  /**
   * Companies the caller administers, primary first. Several of them render a
   * company picker on create; one or none renders nothing.
   */
  adminCompanies?: MyCompany[];
  submitting: boolean;
  onSubmit: (values: ProjectFormValues) => void;
};

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
    { project, adminCompanies = [], submitting, onSubmit },
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
    // Choosing is only meaningful with more than one company to choose from. An
    // existing project keeps no picker: changing its company is not what this
    // form does.
    const needsCompanyPicker = !project && adminCompanies.length > 1;
    const defaultCompanyId =
      adminCompanies.find((company) => company.is_primary)?.id ??
      adminCompanies[0]?.id ??
      null;
    const [companyId, setCompanyId] = useState<string | null>(defaultCompanyId);

    useEffect(() => setDraft(toDraft(project)), [project]);
    // The companies query can still be in flight when the sheet opens; adopt the
    // default as soon as it lands, without overriding an explicit choice.
    useEffect(() => {
      setCompanyId((current) => current ?? defaultCompanyId);
    }, [defaultCompanyId]);

    useImperativeHandle(ref, () => ({
      open: () => {
        setDraft(toDraft(project));
        setCompanyId(defaultCompanyId);
        setAddressError(null);
        sheet.current?.present();
      },
      close: () => sheet.current?.dismiss(),
    }));

    function submit() {
      const address = draft.address.trim();
      if (!address) return setAddressError(t("project.form.addressRequired"));
      const budgetText = draft.budget.trim();
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
      if (needsCompanyPicker && companyId) values.company_id = companyId;
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
          <Input
            testID="project-form-name"
            label={t("project.form.nameOptional")}
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            placeholder={t("project.form.namePlaceholder")}
          />
          {needsCompanyPicker ? (
            <Select
              testID="project-form-company"
              label={t("project.form.company")}
              value={companyId}
              options={adminCompanies.map((company) => ({
                value: company.id,
                label: company.legal_name,
              }))}
              onChange={setCompanyId}
            />
          ) : null}
          {canViewBudget ? (
            <>
              <Input
                testID="project-form-budget"
                label={t("project.form.budget")}
                value={draft.budget}
                onChangeText={(budget) => setDraft({ ...draft, budget })}
                keyboardType="decimal-pad"
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
              onChangeText={(invoicePrefix) =>
                setDraft({ ...draft, invoicePrefix })
              }
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
