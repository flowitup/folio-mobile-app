/** First and last ISO day of a `YYYY-MM` month (the attendance list/summary range). */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`,
  };
}
