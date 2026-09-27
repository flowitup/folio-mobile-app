import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

/** A file selected on the device, ready to append to FormData. */
export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

/** Callers distinguish "user cancelled" from "permission denied" to offer the settings deep link. */
export type PickResult =
  | { status: "picked"; files: PickedFile[] }
  | { status: "canceled" }
  | { status: "denied" };

/**
 * Neither picker gives back the picture's own name on Android: the photo picker reports its
 * MediaStore row id ("29.png") and the cache copy it makes is named with a bare UUID. Listing
 * a document under either is no help to anyone, so treat them as no name at all and fall back
 * to the dated default. A name with any word in it — "IMG_20260916.jpg", "plan-rdc.pdf" — is
 * kept as the user knows it.
 */
const MEANINGLESS_NAME =
  /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\.[A-Za-z0-9]+)?$/i;

/** `2026-09-16-0339` — readable in a file list, and distinct enough between two picks. */
function stamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  ].join("-");
}

export function imageAssetToFile(
  asset: ImagePicker.ImagePickerAsset,
  now: Date = new Date(),
): PickedFile {
  const isVideo = asset.type === "video";
  const mimeType = asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg");
  const extension = mimeType.split("/")[1] ?? (isVideo ? "mp4" : "jpg");
  const given =
    asset.fileName && !MEANINGLESS_NAME.test(asset.fileName)
      ? asset.fileName
      : null;
  return {
    uri: asset.uri,
    name: given ?? `${isVideo ? "video" : "photo"}-${stamp(now)}.${extension}`,
    mimeType,
    size: asset.fileSize,
  };
}

/** Opens the camera (needs the camera permission). */
export async function captureImage(): Promise<PickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: "denied" };
  const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
  if (result.canceled || !result.assets[0]) return { status: "canceled" };
  return { status: "picked", files: [imageAssetToFile(result.assets[0])] };
}

/**
 * Opens the system photo picker. No library permission is requested: iOS 14+ and
 * Android 13+ use a privacy picker that works without it.
 */
export async function pickImages(
  multiple = false,
  includeVideos = false,
): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: includeVideos ? ["images", "videos"] : ["images"],
    allowsMultipleSelection: multiple,
    quality: 0.85,
    // Ask iOS for JPEG-compatible assets instead of HEIC: the API only accepts jpeg / png / webp.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return { status: "canceled" };
  return {
    status: "picked",
    files: result.assets.map((asset) => imageAssetToFile(asset)),
  };
}

/** Opens the system document picker (PDF, images, spreadsheets…). */
export async function pickDocuments(
  multiple = false,
  type: string | string[] = "*/*",
): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple,
    type,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return { status: "canceled" };
  return {
    status: "picked",
    files: result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size,
    })),
  };
}
