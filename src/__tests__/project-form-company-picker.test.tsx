import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import type { MyCompany } from "@/features/companies/companies-api";
import { ProjectFormSheet } from "@/features/projects/project-form-sheet";
import type { ProjectFormSheetHandle } from "@/features/projects/project-form-sheet";
import type { Project } from "@/features/projects/projects-api";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "qa@example.com",
      permissions: ["*:*"],
      companies: [],
      is_platform_ops: false,
    },
  }),
}));

/** The picker reads id, legal_name and is_primary; the rest is filler the type demands. */
function company(id: string, legalName: string, isPrimary: boolean): MyCompany {
  return {
    id,
    legal_name: legalName,
    is_primary: isPrimary,
    role: "admin",
    attached_at: "2026-01-01T00:00:00Z",
    address: "1 rue de la Recette, 75000 Paris",
    siret: null,
    tva_number: null,
    iban: null,
    bic: null,
    logo_url: null,
    default_payment_terms: null,
    prefix_override: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// Deliberately not primary-first: the default must come from `is_primary`, not from position.
const SECOND = company("c2", "AVN Construction SAS", false);
const PRIMARY = company("c1", "Folio QA", true);

const EXISTING = {
  id: "p1",
  name: "Chantier Rivoli",
  address: null,
  company_id: PRIMARY.id,
  my_permissions: ["project:view_budget"],
} as Project;

async function renderForm(adminCompanies: MyCompany[], project?: Project) {
  const onSubmit = jest.fn();
  const ref = createRef<ProjectFormSheetHandle>();
  const view = await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ProjectFormSheet
        ref={ref}
        project={project}
        adminCompanies={adminCompanies}
        submitting={false}
        onSubmit={onSubmit}
      />
    </SafeAreaProvider>,
  );
  return { onSubmit, ref, view };
}

async function fillNameAndSubmit(name = "Chantier Rivoli") {
  await fireEvent.changeText(screen.getByTestId("project-form-name"), name);
  await fireEvent.press(screen.getByTestId("project-form-submit"));
}

describe("ProjectFormSheet company picker", () => {
  it("submits the company the admin picks", async () => {
    const { onSubmit } = await renderForm([SECOND, PRIMARY]);

    await fireEvent.press(screen.getByTestId("project-form-company"));
    await fireEvent.press(
      screen.getByTestId(`project-form-company-option-${SECOND.id}`),
    );
    await fillNameAndSubmit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Chantier Rivoli",
        company_id: SECOND.id,
      }),
    );
  });

  it("falls back to the primary company when the picker is left alone", async () => {
    const { onSubmit } = await renderForm([SECOND, PRIMARY]);

    await fillNameAndSubmit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: PRIMARY.id }),
    );
  });

  it("adopts the default when the companies query resolves after the sheet opened", async () => {
    // The sheet can be opened before `useMyCompanies` settles; without the effect
    // that adopts the default, the payload would carry no company at all.
    const onSubmit = jest.fn();
    const ref = createRef<ProjectFormSheetHandle>();
    const view = await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ProjectFormSheet
          ref={ref}
          adminCompanies={[]}
          submitting={false}
          onSubmit={onSubmit}
        />
      </SafeAreaProvider>,
    );
    await act(async () => ref.current?.open());

    await view.rerender(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ProjectFormSheet
          ref={ref}
          adminCompanies={[SECOND, PRIMARY]}
          submitting={false}
          onSubmit={onSubmit}
        />
      </SafeAreaProvider>,
    );
    await fillNameAndSubmit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: PRIMARY.id }),
    );
  });

  it("renders no picker for an admin of a single company, and sends no company", async () => {
    // One company means nothing to choose: the API resolves it from the caller.
    const { onSubmit } = await renderForm([PRIMARY]);

    expect(screen.queryByTestId("project-form-company")).toBeNull();
    await fillNameAndSubmit();

    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("company_id");
  });

  it("renders no picker when editing an existing project", async () => {
    await renderForm([SECOND, PRIMARY], EXISTING);

    expect(screen.queryByTestId("project-form-company")).toBeNull();
  });
});
