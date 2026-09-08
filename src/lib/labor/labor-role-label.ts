/** Seed labor roles the backend ships for every company (`tho_chinh` / `tho_phu`), keyed by slug. */
const SEED_SLUGS = ["tho_chinh", "tho_phu"] as const;
type SeedSlug = (typeof SEED_SLUGS)[number];

function isSeedSlug(slug: string): slug is SeedSlug {
  return (SEED_SLUGS as readonly string[]).includes(slug);
}

/**
 * Display label for a labor role. The two seed roles carry a `slug` (`tho_chinh`/`tho_phu`) —
 * translate those via `labor.roles.<slug>` so every locale reads them in its own language.
 * A company's own custom role (no slug, or an unrecognised one) falls back to its stored name.
 */
export function laborRoleLabel(
  role: { name: string; slug?: string | null },
  t: (key: string) => string,
): string {
  if (role.slug && isSeedSlug(role.slug)) return t(`labor.roles.${role.slug}`);
  return role.name;
}
