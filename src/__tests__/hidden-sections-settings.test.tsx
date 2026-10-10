import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import HiddenSectionsScreen from "../../app/(app)/(tabs)/settings/hidden-sections";
import {
  COMPANY_ID,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona, Role } from "./helpers/release-qa-fixtures";

/**
 * Settings → Hidden sections: company admins switch Menu areas off for the whole company; the
 * choice is saved on the company (`PUT /companies/<id>` with `hidden_sections`).
 */
let mockCurrent: Persona = persona("admin");
let mockHidden: string[] = [];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockCurrent.user }),
}));

const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
  },
}));

function answerCompanies(role: Role) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === "/api/v1/companies")
      return ok({
        items: [
          {
            company: {
              id: COMPANY_ID,
              legal_name: "Folio QA",
              hidden_sections: mockHidden,
            },
            access: {
              role,
              is_primary: true,
              attached_at: "2026-09-01T08:00:00Z",
            },
          },
        ],
      });
    return ok({});
  });
}

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
  mockHidden = [];
  mockPut.mockResolvedValue(ok({ id: COMPANY_ID }));
});

describe("Settings → Hidden sections", () => {
  it("saves the switched-off section on the company", async () => {
    mockCurrent = persona("admin");
    answerCompanies("admin");
    await renderWithProviders(<HiddenSectionsScreen />);

    const chiffrage = await screen.findByTestId("hidden-section-chiffrage");
    expect(chiffrage.props.value).toBe(true);
    fireEvent(chiffrage, "valueChange", false);

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut.mock.calls[0][1]).toMatchObject({
      params: { path: { company_id: COMPANY_ID } },
      body: { hidden_sections: ["chiffrage"] },
    });
  });

  it("shows an already hidden section switched off and switches it back on", async () => {
    mockCurrent = persona("admin");
    mockHidden = ["analyses", "notes"];
    answerCompanies("admin");
    await renderWithProviders(<HiddenSectionsScreen />);

    const analyses = await screen.findByTestId("hidden-section-analyses");
    expect(analyses.props.value).toBe(false);
    fireEvent(analyses, "valueChange", true);

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut.mock.calls[0][1].body).toEqual({
      hidden_sections: ["notes"],
    });
  });

  it("offers no switches to a plain member", async () => {
    mockCurrent = persona("member");
    answerCompanies("member");
    await renderWithProviders(<HiddenSectionsScreen />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(await screen.findByText(/admin|quản trị/i)).toBeTruthy();
    expect(screen.queryByTestId("hidden-section-chiffrage")).toBeNull();
  });
});
