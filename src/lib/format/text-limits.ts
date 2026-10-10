/**
 * Longest text the API accepts per field (backend `app/api/v1/<feature>/schemas.py`).
 * Passed as `maxLength` to the form inputs so an over-long value stops at the limit
 * instead of failing with a generic "invalid input" toast.
 */
export const TEXT_LIMITS = {
  note: { title: 200, description: 2000 },
  task: { title: 255, description: 5000, label: 50 },
  chiffrage: {
    posteName: 120,
    articleName: 200,
    roomName: 120,
    storeName: 160,
    unitSymbol: 16,
    note: 2000,
    address: 500,
    url: 500,
    supplierName: 120,
    imageUrl: 1000,
  },
  warehouse: { name: 120, address: 500 },
  inventoryItem: { name: 200, reference: 120, description: 2000 },
  product: {
    name: 500,
    supplierName: 255,
    supplierReference: 200,
    category: 200,
    description: 1000,
    size: 100,
    url: 500,
  },
} as const;

/** Most labels one task can carry (backend `tasks/schemas.py` MAX_LABELS). */
export const MAX_TASK_LABELS = 20;
