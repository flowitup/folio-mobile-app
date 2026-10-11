/**
 * Tab screens stay mounted, so data that changed elsewhere (access granted by someone else)
 * showed old values until a restart. A route change refetches the on-screen queries that are
 * past their stale time.
 */

import { render } from "@testing-library/react-native";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";

import { RefreshStaleOnNavigation } from "@/components/shell/refresh-stale-on-navigation";

let mockPathname = "/a";
jest.mock("expo-router", () => ({ usePathname: () => mockPathname }));

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mountWithActiveQuery(staleTime: number) {
  const queryClient = new QueryClient();
  const queryFn = jest.fn(async () => "data");
  const observer = new QueryObserver(queryClient, {
    queryKey: ["projects"],
    queryFn,
    staleTime,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await tick();
  queryFn.mockClear();
  // A fresh element each time: React skips a re-render for an identical one.
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <RefreshStaleOnNavigation />
    </QueryClientProvider>
  );
  const view = await render(tree());
  return { view, tree, queryFn, unsubscribe };
}

afterEach(() => {
  mockPathname = "/a";
});

it("refetches a stale on-screen query when the route changes", async () => {
  const { view, tree, queryFn, unsubscribe } = await mountWithActiveQuery(0);
  mockPathname = "/b";
  await view.rerender(tree());
  await tick();
  expect(queryFn).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("leaves a fresh query alone", async () => {
  const { view, tree, queryFn, unsubscribe } =
    await mountWithActiveQuery(60_000);
  mockPathname = "/b";
  await view.rerender(tree());
  await tick();
  expect(queryFn).not.toHaveBeenCalled();
  unsubscribe();
});
