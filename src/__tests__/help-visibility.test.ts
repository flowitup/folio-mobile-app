/**
 * The guide lists what the reader's own navigation lists. These assertions pin that rule, and —
 * more importantly — pin the gate sets to the catalogue: a renamed or removed topic id would
 * otherwise leave a dead gate behind and silently show a worker a screen they cannot open.
 */

import { helpCatalogueEn } from "@/content/help/en";
import {
  EXTRA_GATED_TOPIC_IDS,
  MANAGER_ONLY_TOPIC_IDS,
  visibleHelpTopics,
  type HelpViewer,
} from "@/content/help/visibility";

const OWNER: HelpViewer = {
  workerMode: false,
  canUpdateProject: true,
  billingAllowed: true,
  companyAdmin: true,
};
const WORKER: HelpViewer = {
  workerMode: true,
  canUpdateProject: false,
  billingAllowed: false,
  companyAdmin: false,
};
const MEMBER: HelpViewer = {
  workerMode: false,
  canUpdateProject: false,
  billingAllowed: false,
  companyAdmin: false,
};

const idsFor = (viewer: HelpViewer) =>
  visibleHelpTopics(helpCatalogueEn, viewer).map((topic) => topic.id);

describe("help visibility", () => {
  const known = new Set(helpCatalogueEn.map((topic) => topic.id));

  it("gates only ids that exist in the catalogue", () => {
    expect(MANAGER_ONLY_TOPIC_IDS.filter((id) => !known.has(id))).toEqual([]);
    expect(EXTRA_GATED_TOPIC_IDS.filter((id) => !known.has(id))).toEqual([]);
  });

  it("shows an owner everything except the worker screens", () => {
    const owner = idsFor(OWNER);
    const workerTopics = helpCatalogueEn
      .filter((topic) => topic.workerMode)
      .map((topic) => topic.id);

    expect(workerTopics.length).toBeGreaterThan(0);
    for (const id of workerTopics) expect(owner).not.toContain(id);
    expect(owner.length).toBe(helpCatalogueEn.length - workerTopics.length);
  });

  it("gives a worker their own screens and nothing behind the Menu", () => {
    const worker = idsFor(WORKER);

    expect(worker).toEqual(
      expect.arrayContaining([
        "worker-attendance",
        "worker-salary",
        "worker-profile",
      ]),
    );
    // Worker mode drops the Menu item entirely, so none of these is reachable.
    for (const id of MANAGER_ONLY_TOPIC_IDS) expect(worker).not.toContain(id);
    // What they can still reach stays.
    for (const id of [
      "getting-started",
      "shell",
      "planning",
      "notifications",
    ]) {
      expect(worker).toContain(id);
    }
  });

  it("hides the three extra-gated areas from a plain member", () => {
    const member = idsFor(MEMBER);
    for (const id of EXTRA_GATED_TOPIC_IDS) expect(member).not.toContain(id);
    for (const id of EXTRA_GATED_TOPIC_IDS) expect(idsFor(OWNER)).toContain(id);
  });

  it("leaves a member the areas the Menu still offers them", () => {
    const member = idsFor(MEMBER);
    for (const id of ["photos", "notes", "chiffrage", "library", "salaries"]) {
      expect(member).toContain(id);
    }
  });
});
