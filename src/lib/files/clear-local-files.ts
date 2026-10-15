import { Directory, Paths } from "expo-file-system";

/** Cache entries the app creates itself: `downloadToCache` folders (`share-` is the older name) and chat voice notes. */
const OWN_ENTRY = /^((download|share)-\d+|chat-voice-.+\.m4a)$/;
/** Folders the app's own helpers and Expo modules fill with the user's files: upload renames, print output, picker copies, voice recordings. */
const OWN_FOLDERS = [
  "upload-names",
  "Print",
  "DocumentPicker",
  "ImagePicker",
  "Audio",
];

/**
 * Deletes what the signed-in user left in the app cache: downloaded invoices and exports, copies
 * of picked documents and photos, printed PDFs and voice notes. The rest of the cache (image
 * thumbnails, the OS's own entries) stays. Best effort and synchronous, so a file that cannot be
 * removed never blocks signing out.
 */
export function clearLocalUserFiles(): void {
  const remove = (entry: { delete: () => void }) => {
    try {
      entry.delete();
    } catch {
      // already gone or held open: the OS reclaims the cache anyway
    }
  };
  try {
    for (const entry of new Directory(Paths.cache).list())
      if (OWN_ENTRY.test(entry.name)) remove(entry);
  } catch {
    // cache unreadable: nothing to clear
  }
  for (const name of OWN_FOLDERS) {
    try {
      const folder = new Directory(Paths.cache, name);
      if (folder.exists) remove(folder);
    } catch {
      // folder inaccessible: leave it
    }
  }
}
