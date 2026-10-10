/**
 * Business dates the API accepts (backend `app/api/v1/date_bounds.py`). An expense date
 * outside these years is refused with a 400, so the date pickers stop there.
 */

/** Earliest accepted day, ISO `YYYY-MM-DD`. */
export const MIN_BUSINESS_DATE = "2000-01-01";
/** Latest accepted day, ISO `YYYY-MM-DD`. */
export const MAX_BUSINESS_DATE = "2100-12-31";
