/**
 * Invitation e-mails link to the web page, `https://<web>/<locale>/accept-invite/<token>`. With
 * the app installed, the universal / app link (app.json associatedDomains, intentFilters) opens
 * the app on that path instead, which has no locale segment here: map it to the app's screen.
 */
const INVITE_PATH =
  /^(?:[a-z][a-z0-9+.-]*:\/\/[^/]*)?\/(?:fr|en|vi)\/accept-invite\/([^/?#]+)/i;

export function inviteRouteOf(path: string): string | null {
  const match = path.match(INVITE_PATH);
  return match ? `/accept-invite/${match[1]}` : null;
}

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    return inviteRouteOf(path) ?? path;
  } catch {
    return path;
  }
}
