import { fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import LibraryProductScreen from "../../app/(app)/(tabs)/library/[productId]";
import { isHttpUrl } from "@/features/library/library-helpers";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * The product link comes from an imported record the API does not scheme-check, so the screen only
 * shows and opens http(s): `tel:`, `sms:` or an app scheme would launch another handler on a tap.
 */
let mockProductUrl: string | null = null;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ productId: "prod1" }),
  useFocusEffect: () => undefined,
}));
jest.mock("@/features/companies/companies-api", () => ({
  useCompanyCan: () => false,
}));
jest.mock("@/features/library/library-api", () => ({
  productImagePath: () => "/p",
  useProduct: () => ({
    isPending: false,
    data: {
      product: {
        id: "prod1",
        company_id: "c1",
        supplier_id: "s1",
        name: "Vis",
        supplier_reference: "REF1",
        category: null,
        size: null,
        description: null,
        has_image: false,
        updated_at: "2026-01-01T00:00:00Z",
        purchase_count: 0,
        last_unit_price: null,
        product_url: mockProductUrl,
      },
      purchases: [],
    },
  }),
  useSuppliers: () => ({ data: [] }),
  useUpdateProduct: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteProduct: () => ({ mutate: jest.fn(), isPending: false }),
  useUploadProductImage: () => ({ mutate: jest.fn(), isPending: false }),
  useProductImageFromUrl: () => ({ mutate: jest.fn(), isPending: false }),
}));

describe("isHttpUrl", () => {
  it.each(["https://x.fr/p", "http://x.fr", "HTTPS://X.FR", " https://x.fr "])(
    "accepts %j",
    (url) => expect(isHttpUrl(url)).toBe(true),
  );
  it.each([
    "tel:123",
    "sms:+3300000000?body=hi",
    "mailto:a@b.c",
    "folio://x",
    "javascript:alert(1)",
    "www.castorama.fr/p",
    "",
    null,
    undefined,
  ])("rejects %j", (url) => expect(isHttpUrl(url)).toBe(false));
});

describe("library product link", () => {
  let openURL: jest.SpyInstance;
  beforeEach(() => {
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });
  afterEach(() => openURL.mockRestore());

  it("opens an https link", async () => {
    mockProductUrl = "https://x.fr/p";
    await renderWithProviders(<LibraryProductScreen />);
    await fireEvent.press(await screen.findByTestId("product-open-url"));
    expect(openURL).toHaveBeenCalledWith("https://x.fr/p");
  });

  it.each(["tel:123", "sms:+3300000000?body=hi", "folio://x"])(
    "shows no link for %s",
    async (url) => {
      mockProductUrl = url;
      await renderWithProviders(<LibraryProductScreen />);
      expect(await screen.findByText("Vis")).toBeTruthy();
      expect(screen.queryByTestId("product-open-url")).toBeNull();
      expect(openURL).not.toHaveBeenCalled();
    },
  );
});
