/** Seed labor roles the backend ships for every company (`tho_chinh` / `tho_phu`), keyed by slug. */
const SEED_SLUGS = ["tho_chinh", "tho_phu"] as const;
type SeedSlug = (typeof SEED_SLUGS)[number];

/**
 * Every name a seed role is created with: Vietnamese for older companies, and the creator's
 * language (fr / en / vi) since the API seeds localized names. A seed role still carrying one of
 * them was not renamed by the company, so it reads in the viewer's language.
 */
const SEED_NAMES: Record<SeedSlug, readonly string[]> = {
  tho_chinh: ["Thợ chính", "Ouvrier principal", "Lead worker"],
  tho_phu: ["Thợ phụ", "Ouvrier auxiliaire", "Assistant worker"],
};

function isSeedSlug(slug: string): slug is SeedSlug {
  return (SEED_SLUGS as readonly string[]).includes(slug);
}

/** Names can arrive composed or decomposed and in any case; compare them folded. */
const foldName = (name: string): string =>
  name.normalize("NFC").trim().toLocaleLowerCase();

function isSeedName(slug: SeedSlug, name: string): boolean {
  const folded = foldName(name);
  return SEED_NAMES[slug].some((seed) => foldName(seed) === folded);
}

/** The seed slug a role name stands for when the API sent no slug (older API, worker rows). */
function seedSlugForName(name: string): SeedSlug | undefined {
  return SEED_SLUGS.find((slug) => isSeedName(slug, name));
}

/**
 * Display label for a labor role. The two seed roles carry a `slug` (`tho_chinh`/`tho_phu`) —
 * translate those via `labor.roles.<slug>` so every locale reads them in its own language.
 * A rename keeps the slug, so a seed role whose stored name is no longer a seed name shows
 * the name the company chose (as on the web). A company's own custom role falls back to its
 * stored name. Without a slug, a seed name is still recognised (the API refuses a custom role
 * named like an unrenamed seed role).
 */
export function laborRoleLabel(
  role: { name: string; slug?: string | null },
  t: (key: string) => string,
): string {
  const slug =
    role.slug && isSeedSlug(role.slug)
      ? role.slug
      : !role.slug && role.name
        ? seedSlugForName(role.name)
        : undefined;
  if (slug && (!role.name || isSeedName(slug, role.name)))
    return t(`labor.roles.${slug}`);
  return role.name;
}

/** Label of a worker's role (`role_name` / `role_slug` on worker rows), or null without a role. */
export function workerRoleLabel(
  worker: { role_name?: string | null; role_slug?: string | null },
  t: (key: string) => string,
): string | null {
  if (!worker.role_name) return null;
  return laborRoleLabel({ name: worker.role_name, slug: worker.role_slug }, t);
}

/** The backend's rule for a role colour: `#` and six hexadecimal digits. */
export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
