/** Seed labor roles the backend ships for every company (`tho_chinh` / `tho_phu`), keyed by slug. */
const SEED_SLUGS = ["tho_chinh", "tho_phu"] as const;
type SeedSlug = (typeof SEED_SLUGS)[number];

/** The name each seed role is stored with: always Vietnamese, whatever the company or locale. */
const SEED_NAMES: Record<SeedSlug, string> = {
  tho_chinh: "Thợ chính",
  tho_phu: "Thợ phụ",
};

function isSeedSlug(slug: string): slug is SeedSlug {
  return (SEED_SLUGS as readonly string[]).includes(slug);
}

/** Vietnamese names can arrive composed or decomposed; compare them composed. */
const normalizeName = (name: string): string => name.normalize("NFC").trim();

/**
 * Display label for a labor role. The two seed roles carry a `slug` (`tho_chinh`/`tho_phu`) —
 * translate those via `labor.roles.<slug>` so every locale reads them in its own language.
 * A rename keeps the slug, so a seed role whose stored name is no longer the seed name shows
 * the name the company chose (as on the web). A company's own custom role (no slug, or an
 * unrecognised one) falls back to its stored name.
 */
export function laborRoleLabel(
  role: { name: string; slug?: string | null },
  t: (key: string) => string,
): string {
  if (
    role.slug &&
    isSeedSlug(role.slug) &&
    (!role.name || normalizeName(role.name) === SEED_NAMES[role.slug])
  )
    return t(`labor.roles.${role.slug}`);
  return role.name;
}

/** The backend's rule for a role colour: `#` and six hexadecimal digits. */
export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
