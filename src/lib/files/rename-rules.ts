/**
 * Extension of a file name the way the backend reads it (Python `os.path.splitext`,
 * lower-cased): leading dots do not start an extension, so ".env" has none.
 */
export function fileExtension(filename: string): string {
  const base = filename.replace(/^\.+/, "");
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

/**
 * Why the backend would refuse renaming `original` to `next`, or null when it accepts it:
 * the name may not be blank and must keep the original extension.
 */
export function renameProblem(
  original: string,
  next: string,
): "empty" | "extension" | null {
  const trimmed = next.trim();
  if (!trimmed) return "empty";
  return fileExtension(trimmed) === fileExtension(original)
    ? null
    : "extension";
}
