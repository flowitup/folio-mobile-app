type StoreConfig = {
  ios?: { appStoreUrl?: string; bundleIdentifier?: string } | null;
  android?: { playStoreUrl?: string; package?: string } | null;
} | null;

/**
 * Where the update button goes when the server names no `update_url`: the store listing from
 * the app config (`ios.appStoreUrl` / `android.playStoreUrl`), else the Play listing of the
 * Android package, else the App Store app itself. The blocking screen must always offer a way
 * out — without a button the only thing left to do is close the app.
 */
export function fallbackStoreUrl(os: string, config: StoreConfig): string {
  if (os === "android") {
    if (config?.android?.playStoreUrl) return config.android.playStoreUrl;
    const id = config?.android?.package;
    return id
      ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}`
      : "market://search?q=Folio";
  }
  if (config?.ios?.appStoreUrl) return config.ios.appStoreUrl;
  return "itms-apps://apps.apple.com/";
}
