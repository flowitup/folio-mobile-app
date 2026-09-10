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
import { Sheet } from "@/components/ui/sheet";
import { formatMoney, parseMoneyInput } from "@/lib/format/money";

import { projectCan } from "./projects-api";
import type { Project, UpdateProjectBody } from "./projects-api";

export type ProjectFormValues = {
  name: string;
  address: string | null;
  /**
   * Financing side — present only when the caller holds `project:view_budget`.
   * Absent (not null) otherwise: the API refuses a PUT that carries a budget
   * the caller cannot read, and "absent" is how it is told to leave the stored
   * value alone, while null would mean "clear it".
   */
  budget?: number | null;
  budget_source?: string | null;
  invoice_prefix?: string | null;
};

export type ProjectFormSheetHandle = { open: () => void; close: () => void };

type Props = {
  /** Existing project to edit; omit for create. */
  project?: Project;
  submitting: boolean;
  onSubmit: (values: ProjectFormValues) => void;
};

function toDraft(project?: Project) {
  return {
    name: project?.name ?? "",
    address: project?.address ?? "",
    budget: project?.budget != null ? String(project.budget) : "",
    budgetSource: project?.budget_source ?? "",
    invoicePrefix: project?.invoice_prefix ?? "",
  };
}

/** Create / edit project form in a bottom sheet — same fields as the web dialogs. */
export const ProjectFormSheet = forwardRef<ProjectFormSheetHandle, Props>(
  function ProjectFormSheet({ project, submitting, onSubmit }, ref) {
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
    const [nameError, setNameError] = useState<string | null>(null);

    useEffect(() => setDraft(toDraft(project)), [project]);

    useImperativeHandle(ref, () => ({
      open: () => {
        setDraft(toDraft(project));
        setNameError(null);
        sheet.current?.present();
      },
      close: () => sheet.current?.dismiss(),
    }));

    function submit() {
      const name = draft.name.trim();
      if (!name) return setNameError(t("project.form.nameRequired"));
      const budgetText = draft.budget.trim();
      const values: ProjectFormValues = {
        name,
        address: draft.address.trim() || null,
        ...(canViewBudget
          ? {
              budget: budgetText ? parseMoneyInput(budgetText) : null,
              budget_source: draft.budgetSource.trim() || null,
            }
          : {}),
      };
      if (project) values.invoice_prefix = draft.invoicePrefix.trim() || null;
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
            testID="project-form-name"
            label={t("project.form.name")}
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            error={nameError}
            autoFocus
          />
          <Input
            testID="project-form-address"
            label={t("project.form.address")}
            value={draft.address}
            onChangeText={(address) => setDraft({ ...draft, address })}
          />
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
    name: values.name,
    address: values.address,
    // Spread rather than assign: a caller without `project:view_budget` sends
    // no budget key at all, and the API 403s a body that carries one.
    ...("budget" in values ? { budget: values.budget } : {}),
    ...("budget_source" in values
      ? { budget_source: values.budget_source }
      : {}),
    invoice_prefix: values.invoice_prefix ?? null,
  };
}
