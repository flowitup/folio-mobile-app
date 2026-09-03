import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

/** A file selected on the device, ready to append to FormData. */
export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

function imageAssetToFile(asset: ImagePicker.ImagePickerAsset): PickedFile {
  const extension = asset.mimeType?.split("/")[1] ?? "jpg";
  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.${extension}`,
    mimeType: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize,
  };
}

/** Opens the camera. Returns null when the user cancels or denies permission. */
export async function captureImage(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;
  return imageAssetToFile(result.assets[0]);
}

/** Opens the photo library. `multiple` allows several pictures (site photos). */
export async function pickImages(multiple = false): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: multiple,
    quality: 0.85,
  });
  if (result.canceled) return [];
  return result.assets.map(imageAssetToFile);
}

/** Opens the system document picker (PDF, images, spreadsheets…). */
export async function pickDocuments(
  multiple = false,
  type: string | string[] = "*/*",
): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple,
    type,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? "application/octet-stream",
    size: asset.size,
  }));
}
