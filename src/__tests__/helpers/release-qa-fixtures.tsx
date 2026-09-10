import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ComponentProps, ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import type { AuthUser } from "@/auth/auth-context";
import type { FloatingTabBar } from "@/components/shell/floating-tab-bar";
import type { Invoice } from "@/features/invoices/invoice-types";
import type { LaborEntry, Worker } from "@/features/labor/labor-types";
import type { RosterRow } from "@/features/labor/roster-api";
import type { BillingDocument } from "@/features/billing/billing-types";
import type {
  Invitation,
  ProjectMember,
} from "@/features/projects/members-api";
import type { Project } from "@/features/projects/projects-api";
import type { Task } from "@/features/tasks/tasks-api";
import { toIsoDate } from "@/lib/format/date";

/**
 * Shared fixtures for the release QA suites (overview / labor / invoices per company role).
 *
 * The permission sets mirror the backend matrix (`app/domain/authz/matrix.py` at
 * folio-back-end origin/master 8e0c83c), checked live against `GET /projects[].my_permissions`
 * of the three QA personas on 2026-09-09: an admin holds everything company-wide, an assigned
 * manager the project write set, an assigned member only `read` + own attendance + roster —
 * which is what puts them in worker mode. Only `project:read`, `manage_labor`,
 * `manage_invoices`, `view_pay` and `update` are read by the client; the rest is kept so the
 * personas stay faithful to what the API returns.
 */
export const PROJECT_ID = "p1";
export const COMPANY_ID = "c1";
export const TODAY = toIsoDate(new Date());
export const MONTH = TODAY.slice(0, 7);

/** `iso` shifted by `days`, in local calendar arithmetic. */
function shiftDay(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return toIsoDate(new Date(year, month - 1, day + days));
}
/**
 * Two worked days of the current month that are never today: two and one days back, or —
 * on the 1st and 2nd, when there is no room behind — one and two days ahead. A fixture row on
 * today's date would hide the worker's "log this day" card (the day is already logged).
 */
const HAS_ROOM_BEHIND = Number(TODAY.slice(8)) >= 3;
export const WORKED_DAY_A = shiftDay(TODAY, HAS_ROOM_BEHIND ? -2 : 1);
export const WORKED_DAY_B = shiftDay(TODAY, HAS_ROOM_BEHIND ? -1 : 2);
const YEAR = Number(MONTH.slice(0, 4));
const MONTH_NUMBER = Number(MONTH.slice(5, 7));

const ADMIN_ONLY = [
  "project:create",
  "project:delete",
  "company:manage_members",
  "company:manage_settings",
  "company:manage_billing",
];
const MANAGER_PROJECT = [
  "project:read",
  "project:update",
  "project:invite",
  "project:manage_users",
  "project:manage_labor",
  "project:manage_invoices",
  "bibliotheque:manage",
  "project:log_own_attendance",
  "project:view_pay",
  "project:view_roster",
];
const MEMBER_PROJECT = [
  "project:read",
  "project:log_own_attendance",
  "project:view_roster",
];
const UNASSIGNED = ["user:read"];

export const MATRIX = {
  admin: [...ADMIN_ONLY, ...MANAGER_PROJECT, ...UNASSIGNED],
  manager: [...MANAGER_PROJECT, ...UNASSIGNED],
  member: [...MEMBER_PROJECT, ...UNASSIGNED],
} as const;

export type Role = keyof typeof MATRIX;

export type Persona = {
  role: Role;
  /** `my_permissions` of the QA project (also what `/auth/me` returns since Phase 4). */
  scoped: string[];
  user: AuthUser;
};

/**
 * A signed-in QA persona. `deny` models a D8 per-project deny: it is removed from the project
 * row (`my_permissions`) only, while `/auth/me.permissions` keeps the company-wide matrix — a
 * screen that falls back to the JWT-wide list instead of the scoped one would wrongly pass.
 */
export function persona(
  role: Role,
  options: { deny?: string[] } = {},
): Persona {
  const companyWide = [...MATRIX[role]];
  const scoped = companyWide.filter(
    (permission) => !options.deny?.includes(permission),
  );
  return {
    role,
    scoped,
    user: {
      id: `u-${role}`,
      email: `qa.${role}@example.com`,
      phone: null,
      permissions: companyWide,
      companies: [
        {
          id: COMPANY_ID,
          legal_name: "Folio QA",
          role,
          is_primary: true,
        },
      ],
      is_platform_ops: false,
    },
  };
}

export const WORKER_MINH: Worker = {
  id: "w-minh",
  project_id: PROJECT_ID,
  name: "Minh Worker",
  phone: null,
  daily_rate: 150,
  is_active: true,
  created_at: "2026-09-01T08:00:00Z",
  user_id: "u-member",
  role_name: null,
  role_color: null,
};
export const WORKER_TUAN: Worker = {
  id: "w-tuan",
  project_id: PROJECT_ID,
  name: "Tuan Worker",
  phone: null,
  daily_rate: 120,
  is_active: true,
  created_at: "2026-09-01T08:00:00Z",
  user_id: null,
  role_name: null,
  role_color: null,
};
export const WORKERS: Worker[] = [WORKER_MINH, WORKER_TUAN];

function entry(
  id: string,
  worker: Worker,
  date: string,
  overrides: Partial<LaborEntry> = {},
): LaborEntry {
  return {
    id,
    worker_id: worker.id,
    worker_name: worker.name,
    date,
    amount_override: null,
    effective_cost: worker.daily_rate,
    note: null,
    shift_type: "full",
    supplement_hours: 0,
    created_at: `${date}T08:00:00Z`,
    status: "validated",
    ...overrides,
  };
}

/** Tuan: two validated days; Minh: one validated day and today's self-logged, pending day. */
export const ENTRY_MINH_PENDING = entry("e-minh-today", WORKER_MINH, TODAY, {
  status: "pending",
  effective_cost: 0,
  submitted_by_user_id: "u-member",
});
export const ENTRIES: LaborEntry[] = [
  entry("e-tuan-1", WORKER_TUAN, WORKED_DAY_A),
  entry("e-tuan-2", WORKER_TUAN, WORKED_DAY_B, {
    shift_type: "half",
    effective_cost: 60,
  }),
  entry("e-minh-1", WORKER_MINH, WORKED_DAY_A),
  ENTRY_MINH_PENDING,
];

export const ROSTER: RosterRow[] = [
  {
    worker_id: WORKER_TUAN.id,
    name: "Tuan Worker",
    status: "present",
    hours: 8,
    day_type: "full",
  },
  {
    worker_id: WORKER_MINH.id,
    name: "Minh Worker",
    status: "pending",
    hours: 8,
    day_type: "full",
  },
];

export const LABOR_SUMMARY = {
  rows: [
    {
      worker_id: WORKER_MINH.id,
      worker_name: "Minh Worker",
      days_worked: 1,
      total_cost: 150,
      banked_hours: 0,
      bonus_full_days: 0,
      bonus_half_days: 0,
      bonus_cost: 0,
    },
    {
      worker_id: WORKER_TUAN.id,
      worker_name: "Tuan Worker",
      days_worked: 1.5,
      total_cost: 180,
      banked_hours: 0,
      bonus_full_days: 0,
      bonus_half_days: 0,
      bonus_cost: 0,
    },
  ],
  total_days: 2.5,
  total_cost: 330,
  total_banked_hours: 0,
  total_bonus_days: 0,
  total_bonus_cost: 0,
};

export const LABOR_MONTHLY = {
  rows: [
    {
      year: YEAR,
      month: MONTH_NUMBER,
      total_days: 2.5,
      total_cost: 330,
      workers: [
        {
          worker_id: WORKER_MINH.id,
          worker_name: "Minh Worker",
          days_worked: 1,
          total_cost: 150,
        },
        {
          worker_id: WORKER_TUAN.id,
          worker_name: "Tuan Worker",
          days_worked: 1.5,
          total_cost: 180,
        },
      ],
    },
  ],
};

function invoice(
  id: string,
  type: Invoice["type"],
  recipient: string,
  total: number,
  overrides: Partial<Invoice> = {},
): Invoice {
  return {
    id,
    project_id: PROJECT_ID,
    invoice_number: `INV-${id.toUpperCase()}`,
    type,
    issue_date: `${MONTH}-03`,
    recipient_name: recipient,
    recipient_address: null,
    notes: null,
    items: [
      {
        description: recipient,
        quantity: 1,
        unit_price: total,
        vat_rate: 0,
        total,
      },
    ],
    total_amount: total,
    created_by: "u-admin",
    created_at: `${MONTH}-03T08:00:00Z`,
    updated_at: `${MONTH}-03T08:00:00Z`,
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    worker_id: null,
    refundable_status: null,
    paid_by_company: false,
    paid_by_personal: false,
    ...overrides,
  };
}

export const INVOICE_RELEASE = invoice(
  "release",
  "released_funds",
  "Banque",
  20000,
  {
    issue_date: `${MONTH}-01`,
  },
);
export const INVOICE_MATERIALS = invoice(
  "materials",
  "materials_services",
  "Leroy Merlin",
  540,
  {
    paid_by_personal: true,
  },
);
/** Paid to Tuan for this month; Minh has no payment yet. */
export const INVOICE_LABOR_TUAN = invoice(
  "labor-tuan",
  "labor",
  "Tuan Worker",
  100,
  {
    worker_id: WORKER_TUAN.id,
    service_month: `${MONTH}-01`,
  },
);
/** A labor invoice nobody assigned to a worker — listed under "unassigned" on the Labor tab. */
export const INVOICE_LABOR_UNASSIGNED = invoice(
  "labor-loose",
  "labor",
  "Intérim",
  80,
  {
    worker_id: null,
    service_month: `${MONTH}-01`,
  },
);
export const INVOICES: Invoice[] = [
  INVOICE_RELEASE,
  INVOICE_MATERIALS,
  INVOICE_LABOR_TUAN,
  INVOICE_LABOR_UNASSIGNED,
];

export const LABOR_PAYMENTS = {
  months: [
    {
      year: YEAR,
      month: MONTH_NUMBER,
      total_paid: 180,
      workers: [
        {
          worker_id: WORKER_TUAN.id,
          worker_name: "Tuan Worker",
          paid: 100,
          invoice_count: 1,
        },
      ],
      unassigned_paid: 80,
      unassigned_count: 1,
    },
  ],
};

export const TASKS: Task[] = [
  {
    id: "t1",
    project_id: PROJECT_ID,
    title: "Livraison carrelage",
    description: null,
    status: "todo",
    priority: "high",
    assignee_id: null,
    due_date: TODAY,
    labels: [],
    position: 0,
    created_by: "u-admin",
    created_at: `${MONTH}-01T08:00:00Z`,
    updated_at: `${MONTH}-01T08:00:00Z`,
  },
];

/** `GET /projects/{id}/members` — the company people assigned to the QA project. */
export const MEMBERS: ProjectMember[] = [
  {
    user_id: "u-manager",
    email: "qa.manager@example.com",
    display_name: "Manager Persona",
    role_name: "manager",
    joined_at: "2026-09-01T08:00:00Z",
  },
  {
    user_id: "u-member",
    email: "qa.member@example.com",
    display_name: "Minh Worker",
    role_name: "member",
    joined_at: "2026-09-02T08:00:00Z",
  },
];

/** A legacy email invitation: still revocable from the screen, never created by the app. */
export const INVITATIONS: Invitation[] = [
  {
    id: "i1",
    email: "invited@example.com",
    role_name: "member",
    status: "pending",
    created_at: `${MONTH}-02T08:00:00Z`,
    expires_at: `${MONTH}-09T08:00:00Z`,
    invited_by_name: "QA Admin",
  },
];

/** One quote, so the billing list's response shape is exercised by a rendered row. */
export const BILLING_DEVIS: BillingDocument = {
  id: "bd1",
  user_id: "u-admin",
  company_id: COMPANY_ID,
  project_id: PROJECT_ID,
  kind: "devis",
  document_number: "DEV-2026-0001",
  status: "draft",
  issue_date: `${MONTH}-04`,
  validity_until: null,
  payment_due_date: null,
  payment_terms: null,
  recipient_name: "Client QA",
  recipient_address: null,
  recipient_email: null,
  recipient_siret: null,
  notes: null,
  terms: null,
  signature_block_text: null,
  items: [],
  issuer_legal_name: "Folio QA",
  issuer_address: "1 rue de la Recette, 75000 Paris",
  issuer_siret: null,
  issuer_tva_number: null,
  issuer_iban: null,
  issuer_bic: null,
  issuer_logo_url: null,
  source_devis_id: null,
  total_ht: "1000.00",
  total_tva: "200.00",
  total_ttc: "1200.00",
  created_at: `${MONTH}-04T08:00:00Z`,
  updated_at: `${MONTH}-04T08:00:00Z`,
};

/** The QA project as the backend returns it (list row and detail share the shape). */
export function project(scoped: string[]): Project {
  return {
    id: PROJECT_ID,
    name: "Folio QA Project",
    address: "1 rue de la Recette, 75000 Paris",
    budget: 60000,
    budget_source: "bank_credit",
    company_id: COMPANY_ID,
    owner_id: "u-admin",
    created_at: "2026-09-01T08:00:00Z",
    invoice_prefix: null,
    labor_accrued: 330,
    labor_paid: 100,
    labor_unpaid: 230,
    spent: 640,
    spent_by_credits: 0,
    spent_personal: 540,
    personal_by_type: {},
    user_count: 3,
    my_permissions: scoped,
  } as Project;
}

/** What `useSelectedProject` hands the tabs for a persona. */
export function selectedProject(current: Persona) {
  const row = project(current.scoped);
  return {
    projects: [row],
    project: row,
    projectId: PROJECT_ID,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    select: jest.fn(),
  };
}

export const SHELL = {
  sheet: null,
  openSheet: jest.fn(),
  toggleSheet: jest.fn(),
  closeSheet: jest.fn(),
  tabBarHeight: 72,
  setTabBarHeight: jest.fn(),
};

type GetOptions = {
  params?: { path?: Record<string, string>; query?: Record<string, unknown> };
};

export function ok(data: unknown) {
  return { data, response: { status: 200, statusText: "OK" } };
}

/**
 * Default answers of the mocked `api.GET`, keyed by the OpenAPI path template the hooks call.
 * `current()` is read per call so a test can switch persona between renders.
 */
export function answerGet(
  current: () => Persona,
  overrides: { entries?: LaborEntry[]; workers?: Worker[] } = {},
) {
  return async (path: string, options?: GetOptions) => {
    const query = options?.params?.query ?? {};
    switch (path) {
      case "/api/v1/projects":
        return ok({ projects: [project(current().scoped)], total: 1 });
      case "/api/v1/projects/{project_id}":
        return ok(project(current().scoped));
      case "/api/v1/companies":
        return ok({
          items: [
            {
              company: { id: COMPANY_ID, legal_name: "Folio QA" },
              access: {
                role: current().role,
                is_primary: true,
                attached_at: "2026-09-01T08:00:00Z",
              },
            },
          ],
        });
      case "/api/v1/features":
        return ok({ chat: false });
      case "/api/v1/notifications":
        return ok({ items: [], attendance_pending: [] });
      case "/api/v1/projects/{project_id}/invoices": {
        const type = query.type as string | undefined;
        const workerId = query.worker_id as string | undefined;
        const rows = INVOICES.filter(
          (row) =>
            (!type || row.type === type) &&
            (!workerId || row.worker_id === workerId),
        );
        return ok({
          invoices: rows,
          total: rows.length,
          funds_released_total: 20000,
          funds_released_company_total: 0,
          funds_released_personal_total: 0,
          company_spent_total: 0,
          personal_spent_total: 540,
        });
      }
      case "/api/v1/projects/{project_id}/invoices/{invoice_id}":
        return ok(
          INVOICES.find(
            (row) => row.id === options?.params?.path?.invoice_id,
          ) ?? INVOICE_MATERIALS,
        );
      case "/api/v1/projects/{project_id}/invoices/{invoice_id}/attachments":
        return ok([]);
      case "/api/v1/projects/{project_id}/tasks":
        return ok({ tasks: TASKS });
      case "/api/v1/projects/{project_id}/workers":
        return ok({ workers: overrides.workers ?? WORKERS });
      case "/api/v1/projects/{project_id}/labor-entries": {
        // Same narrowing as the backend: only the rows inside the requested window.
        const from = query.from as string | undefined;
        const to = query.to as string | undefined;
        const rows = (overrides.entries ?? ENTRIES).filter(
          (row) => (!from || row.date >= from) && (!to || row.date <= to),
        );
        return ok({ entries: rows, total: rows.length });
      }
      case "/api/v1/projects/{project_id}/labor-summary":
        return ok(LABOR_SUMMARY);
      case "/api/v1/projects/{project_id}/labor-monthly-summary":
        return ok(LABOR_MONTHLY);
      case "/api/v1/projects/{project_id}/labor-payments-summary":
        return ok(LABOR_PAYMENTS);
      case "/api/v1/projects/{project_id}/labor/roster":
        return ok({ rows: ROSTER });
      case "/api/v1/projects/{project_id}/labor-activities":
        return ok({ activities: [] });
      case "/api/v1/projects/{project_id}/labor-day-descriptions":
        return ok({ descriptions: [] });
      case "/api/v1/projects/{project_id}/members":
        return ok({ members: MEMBERS });
      case "/api/v1/invitations/projects/{project_id}/invitations":
        return ok({ items: INVITATIONS });
      case "/api/v1/billing-documents":
        return ok({ items: [BILLING_DEVIS], total: 1 });
      case "/api/v1/labor/roles":
        return ok({ roles: [], palette: [] });
      case "/api/v1/companies/{company_id}/payment-methods":
        return ok({ items: [] });
      default:
        return ok({});
    }
  };
}

export const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Renders inside the providers the tabs expect; exposes the client to wait on query state. */
export async function renderWithProviders(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const rendered = await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </SafeAreaProvider>,
  );
  return { ...rendered, queryClient };
}

/**
 * RegExp for `toHaveTextContent` that accepts the text anywhere in the node (the matcher
 * takes a string as an exact match); whitespace is normalised the way the matcher does it.
 */
export function containing(text: string): RegExp {
  const normalised = text.replace(/\s+/g, " ");
  return new RegExp(normalised.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

/** Calls of a jest mock whose first argument (the path template) equals `path`. */
export function callsTo(mock: jest.Mock, path: string) {
  return mock.mock.calls.filter((call) => call[0] === path);
}

/**
 * react-navigation tab-bar props for a project navigator sitting on `routes[index]`.
 * The shell reads only the route names and the active index to decide which slots to draw.
 */
export function tabBarProps(
  routeNames: string[] = ["index", "expenses", "labor", "planning"],
  index = 0,
): ComponentProps<typeof FloatingTabBar> {
  return {
    state: {
      index,
      routes: routeNames.map((name) => ({ key: `${name}-key`, name })),
    },
    navigation: {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
    },
  } as unknown as ComponentProps<typeof FloatingTabBar>;
}
