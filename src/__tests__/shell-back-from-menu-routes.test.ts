import {
  CommonActions,
  TabActions,
  TabRouter,
} from "expo-router/build/react-navigation/routers";

import { PROJECT_TABS } from "@/components/shell/floating-tab-bar";
import {
  HIDDEN_ROUTES,
  TABS_BACK_BEHAVIOR,
} from "@/components/shell/tabs-config";

/**
 * QA of the shell's Back after a Menu / Account action. Every destination behind the Menu
 * (settings, billing, library, inventory, company, a project section) is a hidden route of
 * the same tab navigator, so "Back" is the tab router's GO_BACK. It must land on the tab the
 * user left — the bug was Settings → Back landing on the first tab (or whatever tab was
 * first in the navigator state) instead of the one the user came from.
 */

const routeNames = [...PROJECT_TABS, ...HIDDEN_ROUTES];
const options = {
  routeNames,
  routeParamList: Object.fromEntries(
    routeNames.map((name) => [name, undefined]),
  ),
  routeGetIdList: {},
};

function shell(backBehavior: "history" | "firstRoute") {
  const router = TabRouter({ backBehavior });
  let state = router.getInitialState(options);
  const dispatch = (action: Parameters<typeof router.getStateForAction>[1]) => {
    const next = router.getStateForAction(state, action, options);
    // The tab router always answers with a full state; a partial one would be a harness bug.
    if (next === null || next.stale !== false)
      throw new Error("action not handled");
    state = next;
  };
  return {
    open: (name: string) => dispatch(TabActions.jumpTo(name)),
    back: () => dispatch(CommonActions.goBack()),
    current: () => state.routes[state.index].name,
  };
}

describe("Back after a Menu / Account action", () => {
  it.each(HIDDEN_ROUTES)(
    "returns from %s to the tab the user left (expenses)",
    (route) => {
      const nav = shell(TABS_BACK_BEHAVIOR);
      nav.open("expenses");
      nav.open(route);
      expect(nav.current()).toBe(route);
      nav.back();
      expect(nav.current()).toBe("expenses");
    },
  );

  it("returns to the last tab visited, not to an earlier one", () => {
    const nav = shell(TABS_BACK_BEHAVIOR);
    nav.open("expenses");
    nav.open("index");
    nav.open("settings");
    nav.back();
    expect(nav.current()).toBe("index");
  });

  it("walks back through two Menu destinations in order", () => {
    const nav = shell(TABS_BACK_BEHAVIOR);
    nav.open("planning");
    nav.open("settings");
    nav.open("billing");
    nav.back();
    expect(nav.current()).toBe("settings");
    nav.back();
    expect(nav.current()).toBe("planning");
  });

  it("documents the defect the wiring prevents: firstRoute drops the user on the first tab", () => {
    const nav = shell("firstRoute");
    nav.open("expenses");
    nav.open("settings");
    nav.back();
    expect(nav.current()).toBe("index");
  });
});
