import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BillingTemplatesScreen from "../../app/(app)/(tabs)/billing/templates/index";
import NewBillingTemplateScreen from "../../app/(app)/(tabs)/billing/templates/new";
import NewBillingDocumentScreen from "../../app/(app)/(tabs)/billing/documents/new";
import { SAFE_AREA_METRICS, ok, persona } from "./helpers/release-qa-fixtures";

/**
 * Templates belong to a company. An admin of several companies picks which one the templates
 * screen shows (default: the primary), a new template lands in that company, and a document
 * started from one of its templates lists that company's templates.
 */
const mockCurrent = persona("admin");
let mockParams: Record<string, string> = {};
const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockCurrent.user }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

const TEMPLATE = (id: string, name: string) => ({
  id,
  kind: "devis",
  name,
  items: [],
  notes: null,
  terms: null,
  default_vat_rate: null,
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-01T08:00:00Z",
});

type Options = { params?: { query?: Record<string, string> } };
const mockGet = jest.fn(async (path: string, options?: Options) => {
  if (path === "/api/v1/companies")
    return ok({
      items: [
        { id: "c-one", name: "Xco One", role: "admin", primary: true },
        { id: "c-two", name: "Xco Two", role: "admin", primary: false },
        { id: "c-y", name: "Yco", role: "member", primary: false },
      ].map((row) => ({
        company: { id: row.id, legal_name: row.name },
        access: {
          role: row.role,
          is_primary: row.primary,
          attached_at: "2026-09-01T08:00:00Z",
        },
      })),
    });
  if (path === "/api/v1/billing-document-templates") {
    const company = options?.params?.query?.company_id;
    return ok({
      items:
        company === "c-two"
          ? [TEMPLATE("t-two", "Tpl Xco Two")]
          : [TEMPLATE("t-one", "Tpl Xco One")],
    });
  }
  return ok({ items: [] });
});
const mockPost = jest.fn(async (_path: string, options: { body: unknown }) =>
  ok({ ...TEMPLATE("t-new", "New"), ...(options.body as object) }),
);
jest.mock("@/api/client", () => ({
  api: {
    GET: (path: string, options?: Options) => mockGet(path, options),
    POST: (path: string, options: { body: unknown }) => mockPost(path, options),
  },
}));

/**
 * The shared providers, with mutations collected at once: a finished mutation otherwise holds a
 * five-minute garbage-collection timer that keeps Jest from exiting after this file.
 */
async function renderWithProviders(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const templateQueries = () =>
  mockGet.mock.calls
    .filter(([path]) => path === "/api/v1/billing-document-templates")
    .map(([, options]) => options?.params?.query ?? {});

beforeEach(() => {
  mockGet.mockClear();
  mockPost.mockClear();
  mockRouter.push.mockClear();
  mockParams = {};
});

describe("Billing templates screen", () => {
  it("lists the primary admin company's templates, then the picked company's", async () => {
    await renderWithProviders(<BillingTemplatesScreen />);
    expect(await screen.findByTestId("template-t-one")).toBeTruthy();
    expect(templateQueries()[0]).toEqual({ company_id: "c-one" });
    // Only administered companies are offered.
    expect(screen.queryByTestId("templates-company-option-c-y")).toBeNull();

    await fireEvent.press(screen.getByTestId("templates-company-option-c-two"));
    expect(await screen.findByTestId("template-t-two")).toBeTruthy();
    expect(templateQueries()).toContainEqual({ company_id: "c-two" });

    await fireEvent.press(screen.getByTestId("template-new"));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: "/billing/templates/new",
      params: { company: "c-two" },
    });
    await fireEvent.press(screen.getByTestId("template-use-t-two"));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: "/billing/documents/new",
      params: { kind: "devis", template: "t-two", company: "c-two" },
    });
  });
});

describe("New billing template", () => {
  it("creates the template in the company the list was showing", async () => {
    mockParams = { company: "c-two" };
    await renderWithProviders(<NewBillingTemplateScreen />);
    await fireEvent.changeText(screen.getByTestId("template-name"), "Tpl");
    await fireEvent.press(screen.getByTestId("item-add"));
    await fireEvent.changeText(
      screen.getByTestId("item-description-0"),
      "Pose",
    );
    await fireEvent.press(screen.getByTestId("template-submit"));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0][1].body).toMatchObject({
      company_id: "c-two",
    });
  });
});

describe("New document from a template", () => {
  it("lists the templates of the template's company", async () => {
    mockParams = { kind: "devis", template: "t-two", company: "c-two" };
    await renderWithProviders(<NewBillingDocumentScreen />);
    await waitFor(() =>
      expect(templateQueries()).toContainEqual({
        kind: "devis",
        company_id: "c-two",
      }),
    );
    expect(templateQueries()).not.toContainEqual({ kind: "devis" });
  });
});
