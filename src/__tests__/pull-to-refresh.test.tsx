/**
 * QA3 Mac #20 / class 2: list screens had no pull-to-refresh (the iOS bounce refetched nothing),
 * so a change made on another device only showed after an app restart. Pulling now re-reads the
 * screen's data right away, whatever its stale time.
 */

import { act, render, screen } from "@testing-library/react-native";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { ScrollView, Text } from "react-native";

import { billingKeys } from "@/features/billing/billing-documents-api";
import { refundableKeys } from "@/features/billing/refundable-api";
import { templateKeys } from "@/features/billing/billing-templates-api";
import { chatKeys } from "@/features/chat/chat-api";
import { companyKeys } from "@/features/companies/companies-api";
import { inventoryKeys } from "@/features/inventory/inventory-api";
import { laborKeys } from "@/features/labor/labor-api";
import { libraryKeys } from "@/features/library/library-api";
import { projectKeys } from "@/features/projects/projects-api";
import {
  refreshKeys,
  runPullRefresh,
  usePullToRefresh,
} from "@/lib/query/use-pull-to-refresh";

let queryClient: QueryClient;
function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
    },
  });
});
afterEach(() => queryClient.clear());

const notesFetch = jest.fn(async () => "notes");

function NotesScreen({ refetch = [] }: { refetch?: (() => unknown)[] }) {
  const notes = useQuery({
    queryKey: ["projects", "p1", "notes"],
    queryFn: notesFetch,
  });
  const pullToRefresh = usePullToRefresh([["projects"]], { refetch });
  return (
    <ScrollView testID="scroller" refreshControl={pullToRefresh}>
      <Text>{notes.data ?? "…"}</Text>
    </ScrollView>
  );
}

/** The control the scroller was given, as React Native receives it. */
function refreshControl(): {
  props: { refreshing: boolean; onRefresh: () => Promise<void> };
} {
  return screen.getByTestId("scroller").props.refreshControl;
}

describe("usePullToRefresh", () => {
  beforeEach(() => {
    notesFetch.mockClear();
  });

  it("re-reads the screen's queries at once even while they are fresh, then stops spinning", async () => {
    await render(<NotesScreen />, { wrapper: Providers });
    await screen.findByText("notes");
    expect(notesFetch).toHaveBeenCalledTimes(1);
    expect(refreshControl().props.refreshing).toBe(false);

    await act(async () => {
      await refreshControl().props.onRefresh();
    });
    expect(notesFetch).toHaveBeenCalledTimes(2);
    expect(refreshControl().props.refreshing).toBe(false);
  });

  it("also runs the extra refreshers (the signed-in user's permissions)", async () => {
    const refreshUser = jest.fn(async () => undefined);
    await render(<NotesScreen refetch={[refreshUser]} />, {
      wrapper: Providers,
    });
    await screen.findByText("notes");
    await act(async () => {
      await refreshControl().props.onRefresh();
    });
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it("works on a screen rendered without a query client", async () => {
    function Bare() {
      const pullToRefresh = usePullToRefresh([["projects"]]);
      return <ScrollView testID="scroller" refreshControl={pullToRefresh} />;
    }
    await render(<Bare />);
    await act(async () => {
      await refreshControl().props.onRefresh();
    });
    expect(refreshControl().props.refreshing).toBe(false);
  });
});

describe("runPullRefresh", () => {
  it("refetches only the queries on screen under the keys, and survives a failing refresher", async () => {
    // On screen: a project query. Cached but not on screen: another project's list.
    queryClient.setQueryData(["projects", "p2", "notes"], "old");
    await render(<NotesScreen />, { wrapper: Providers });
    await screen.findByText("notes");
    const library = jest.spyOn(queryClient, "refetchQueries");
    const failing = jest.fn(() => Promise.reject(new Error("offline")));
    const ok = jest.fn();

    await act(async () => {
      await runPullRefresh(
        queryClient,
        [["projects"]],
        [failing, undefined, false, ok],
      );
    });
    expect(library).toHaveBeenCalledWith({
      queryKey: ["projects"],
      type: "active",
    });
    expect(notesFetch).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(["projects", "p2", "notes"])).toBe("old");
    expect(failing).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});

describe("refreshKeys", () => {
  it("stay the prefixes of the feature key factories", () => {
    expect(refreshKeys.projects).toEqual(projectKeys.all);
    expect(refreshKeys.companies).toEqual(companyKeys.all);
    expect(refreshKeys.laborRoles).toEqual(laborKeys.roles);
    expect(refreshKeys.library).toEqual(libraryKeys.all);
    expect(refreshKeys.inventory).toEqual(inventoryKeys.all);
    expect(refreshKeys.chatChannels).toEqual(chatKeys.channels);
    expect(refreshKeys.features).toEqual(chatKeys.features);
    for (const key of [billingKeys.all, refundableKeys.all, templateKeys.all])
      expect(key.slice(0, refreshKeys.billing.length)).toEqual(
        refreshKeys.billing,
      );
    // Per-project and per-company queries sit under the two broad prefixes.
    expect(laborKeys.workers("p1").slice(0, 1)).toEqual(refreshKeys.projects);
  });
});
