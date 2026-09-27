import { act, fireEvent, screen } from "@testing-library/react-native";
import { createRef } from "react";

import i18n from "@/i18n";
import {
  budgetProblem,
  isValidInvoicePrefix,
  ProjectFormSheet,
} from "@/features/projects/project-form-sheet";
import type {
  ProjectFormCompany,
  ProjectFormSheetHandle,
} from "@/features/projects/project-form-sheet";
import type { Project } from "@/features/projects/projects-api";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: { permissions: ["project:view_budget"] } }),
}));

const PROJECT = {
  id: "p-1",
  name: "Tower",
  address: "1 rue A",
  budget: 1000,
  budget_source: null,
  invoice_prefix: "TOWER",
  my_permissions: ["project:update", "project:view_budget"],
} as unknown as Project;

async function renderForm(project?: Project, companies?: ProjectFormCompany[]) {
  const onSubmit = jest.fn();
  const ref = createRef<ProjectFormSheetHandle>();
  await renderWithProviders(
    <ProjectFormSheet
      ref={ref}
      project={project}
      submitting={false}
      onSubmit={onSubmit}
      companies={companies}
    />,
  );
  await act(async () => ref.current?.open());
  return onSubmit;
}

describe("budgetProblem", () => {
  it("accepts a blank, zero or formatted budget up to the stored maximum", () => {
    expect(budgetProblem("")).toBeNull();
    expect(budgetProblem("0")).toBeNull();
    expect(budgetProblem("150 000,50")).toBeNull();
    expect(budgetProblem("9999999999.99")).toBeNull();
  });

  it("rejects unreadable, negative and oversized budgets", () => {
    expect(budgetProblem("abc")).toBe("invalid");
    expect(budgetProblem("-500")).toBe("invalid");
    expect(budgetProblem("10000000000")).toBe("tooLarge");
  });
});

describe("isValidInvoicePrefix", () => {
  it("follows the backend's 1-8 letters or digits rule", () => {
    expect(isValidInvoicePrefix("")).toBe(true);
    expect(isValidInvoicePrefix("tour1")).toBe(true);
    expect(isValidInvoicePrefix("qam-12345")).toBe(false);
    expect(isValidInvoicePrefix("ÉTÉ")).toBe(false);
  });
});

describe("ProjectFormSheet", () => {
  it("refuses an unreadable budget on create instead of saving no budget", async () => {
    const onSubmit = await renderForm();
    await fireEvent.changeText(
      screen.getByTestId("project-form-address"),
      "9 rue X",
    );
    await fireEvent.changeText(
      screen.getByTestId("project-form-budget"),
      "abc",
    );
    await fireEvent.press(screen.getByTestId("project-form-submit"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t("project.form.budgetInvalid"))).toBeTruthy();
  });

  it("refuses an unreadable budget on edit instead of clearing the stored one", async () => {
    const onSubmit = await renderForm(PROJECT);
    await fireEvent.changeText(
      screen.getByTestId("project-form-budget"),
      "12x",
    );
    await fireEvent.press(screen.getByTestId("project-form-submit"));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses an invoice prefix the backend would reject", async () => {
    const onSubmit = await renderForm(PROJECT);
    await fireEvent.changeText(
      screen.getByTestId("project-form-invoice-prefix"),
      "qam-12345",
    );
    await fireEvent.press(screen.getByTestId("project-form-submit"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t("project.form.invoicePrefixInvalid")),
    ).toBeTruthy();
  });

  it("submits a valid budget", async () => {
    const onSubmit = await renderForm();
    await fireEvent.changeText(
      screen.getByTestId("project-form-address"),
      "9 rue X",
    );
    await fireEvent.changeText(
      screen.getByTestId("project-form-budget"),
      "1 500,50",
    );
    await fireEvent.press(screen.getByTestId("project-form-submit"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ address: "9 rue X", budget: 1500.5 }),
    );
  });
});

describe("create project · company", () => {
  const COMPANIES: ProjectFormCompany[] = [
    { id: "c-main", legal_name: "Main SARL", is_primary: true },
    { id: "c-second", legal_name: "Second SAS", is_primary: false },
  ];

  it("asks an admin of several companies which one the project belongs to", async () => {
    const onSubmit = await renderForm(undefined, COMPANIES);
    expect(screen.getByTestId("project-form-company")).toHaveTextContent(
      /Main SARL/,
    );
    await fireEvent.changeText(
      screen.getByTestId("project-form-address"),
      "1 rue B",
    );
    await fireEvent.press(screen.getByTestId("project-form-company"));
    await fireEvent.press(
      screen.getByTestId("project-form-company-option-c-second"),
    );
    await fireEvent.press(screen.getByTestId("project-form-submit"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ address: "1 rue B", company_id: "c-second" }),
    );
  });

  it("does not ask an admin of a single company", async () => {
    const onSubmit = await renderForm(undefined, [COMPANIES[0]]);
    expect(screen.queryByTestId("project-form-company")).toBeNull();
    await fireEvent.changeText(
      screen.getByTestId("project-form-address"),
      "1 rue B",
    );
    await fireEvent.press(screen.getByTestId("project-form-submit"));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("company_id");
  });
});
