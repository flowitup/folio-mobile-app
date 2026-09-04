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

function imageAssetToFile(asset: ImagePicker.ImagePickerAsset): PickedFile {
  const isVideo = asset.type === "video";
  const mimeType = asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg");
  const extension = mimeType.split("/")[1] ?? (isVideo ? "mp4" : "jpg");
  return {
    uri: asset.uri,
    name:
      asset.fileName ??
      `${isVideo ? "video" : "photo"}-${Date.now()}.${extension}`,
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
  return { status: "picked", files: result.assets.map(imageAssetToFile) };
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
