/** Project-card budget helpers, copied from the web `lib/projects/budget-display.ts`. */

export interface BudgetMeta {
  creditTotal: number;
  spentByCredits: number;
  spentPersonal: number;
  remaining: number;
  isOverBudget: boolean;
  /** Credit drawdown ratio clamped to [0, 1]; 0 when no credit total is set. */
  progress: number;
}

export function computeBudgetMeta(
  creditTotal: number,
  spentPersonal: number,
  spentByCredits: number,
): BudgetMeta {
  const remaining = creditTotal - spentByCredits;
  const isOverBudget = creditTotal > 0 && remaining < 0;
  const progress =
    creditTotal > 0
      ? Math.max(0, Math.min(spentByCredits / creditTotal, 1))
      : 0;
  return {
    creditTotal,
    spentByCredits,
    spentPersonal,
    remaining,
    isOverBudget,
    progress,
  };
}

export interface PersonalSpendRow {
  type: string;
  amount: number;
}

const TYPE_ORDER = ["labor", "materials_services", "others", "return"];

export function personalSpendRows(
  byType: Record<string, number> | undefined,
): PersonalSpendRow[] {
  return Object.entries(byType ?? {})
    .filter(([, amount]) => amount !== 0)
    .map(([type, amount]) => ({ type, amount }))
    .sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a.type);
      const ib = TYPE_ORDER.indexOf(b.type);
      return (
        (ia === -1 ? TYPE_ORDER.length : ia) -
        (ib === -1 ? TYPE_ORDER.length : ib)
      );
    });
}
