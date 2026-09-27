import i18n from "@/i18n";
import { exportInvoices } from "@/features/invoices/invoices-api";
import { exportLabor } from "@/features/labor/labor-api";

const mockOpenFile = jest.fn(async () => "file://x");
jest.mock("@/lib/files/open-file", () => ({
  openFile: (...args: unknown[]) => mockOpenFile(...(args as [])),
}));
jest.mock("@/api/client", () => ({ api: {} }));

function queryOf(call: unknown[]): URLSearchParams {
  const url = call[0] as string;
  return new URLSearchParams(url.slice(url.indexOf("?") + 1));
}

/** The exports are written in the app's language: the backend takes it as `locale`. */
describe("export locale", () => {
  afterEach(async () => {
    mockOpenFile.mockClear();
    await i18n.changeLanguage("vi");
  });

  it("sends the UI language on the invoice export", async () => {
    await i18n.changeLanguage("fr");
    await exportInvoices("p1", "pdf", "2026-09", "2026-09");
    const call = mockOpenFile.mock.calls[0] as unknown[];
    expect(call[0]).toMatch(/^\/api\/v1\/projects\/p1\/invoices-export\?/);
    expect(queryOf(call).get("locale")).toBe("fr");
  });

  it("sends the UI language on the project and the worker labor exports", async () => {
    await i18n.changeLanguage("en");
    await exportLabor("p1", "xlsx", "2026-08", "2026-09");
    await exportLabor("p1", "pdf", "2026-09", "2026-09", "w1");
    const [project, worker] = mockOpenFile.mock.calls as unknown[][];
    expect(project[0]).toMatch(/^\/api\/v1\/projects\/p1\/labor-export\?/);
    expect(queryOf(project).get("locale")).toBe("en");
    expect(worker[0]).toMatch(
      /^\/api\/v1\/projects\/p1\/workers\/w1\/labor-export\?/,
    );
    expect(queryOf(worker).get("locale")).toBe("en");
  });
});
