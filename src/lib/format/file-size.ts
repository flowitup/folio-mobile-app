import i18n from "@/i18n";
import { formatNumber } from "@/lib/format/money";

const KB = 1024;
const MB = 1024 * 1024;

/**
 * File size in the UI language: `312 Ko` / `1,4 Mo` (fr), `312 KB` / `1.4 MB` (en). A file
 * under half a kilobyte still reads `1 KB`, never `0 KB`.
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= MB)
    return i18n.t("common.fileSize.mb", {
      value: formatNumber(bytes / MB, 1),
    });
  return i18n.t("common.fileSize.kb", {
    value: formatNumber(Math.max(1, Math.round(bytes / KB)), 0),
  });
}
