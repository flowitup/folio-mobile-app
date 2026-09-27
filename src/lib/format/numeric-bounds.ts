/**
 * Upper bounds the API enforces on money and quantity inputs (backend
 * `app/api/v1/numeric_bounds.py`). Checking them in the forms keeps an oversized number
 * from ever reaching the server, and the user gets a translated reason instead of a 400.
 */

/** Worker daily rates, rate changes and labor amount overrides (Numeric(10, 2)). */
export const MAX_DAILY_AMOUNT = 99_999_999.99;
/** Project budget (Numeric(14, 2)). */
export const MAX_BUDGET = 9_999_999_999.99;
/** Quantity of an expense or billing document line. */
export const MAX_LINE_QUANTITY = 9_999_999;
/** Unit price of an expense or billing document line, in either sign. */
export const MAX_LINE_UNIT_PRICE = 999_999_999;
