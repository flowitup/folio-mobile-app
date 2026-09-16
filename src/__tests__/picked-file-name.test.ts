import type * as ImagePicker from "expo-image-picker";

import { imageAssetToFile } from "@/lib/files/pick";

const AT = new Date(2026, 8, 16, 3, 39, 7);

function asset(
  overrides: Partial<ImagePicker.ImagePickerAsset>,
): ImagePicker.ImagePickerAsset {
  return {
    uri: "file:///cache/x",
    width: 800,
    height: 600,
    ...overrides,
  } as ImagePicker.ImagePickerAsset;
}

/**
 * Android's photo picker copies the picture into the app cache and reports that copy's
 * name — a bare UUID — so documents uploaded from the gallery were listed as hex.
 */
describe("naming a picked image", () => {
  it("does not pass a bare MediaStore id through", () => {
    const file = imageAssetToFile(
      asset({ fileName: "29.png", mimeType: "image/png" }),
      AT,
    );

    expect(file.name).toBe("photo-2026-09-16-033907.png");
  });

  it("does not pass the picker's cache-copy name through", () => {
    const file = imageAssetToFile(
      asset({
        fileName: "04b211b3-c726-415a-bd61-dfd8146983bb.png",
        mimeType: "image/png",
      }),
      AT,
    );

    expect(file.name).toBe("photo-2026-09-16-033907.png");
  });

  it("keeps a name a person would recognise", () => {
    const file = imageAssetToFile(
      asset({ fileName: "IMG_20260916_0339.jpg", mimeType: "image/jpeg" }),
      AT,
    );

    expect(file.name).toBe("IMG_20260916_0339.jpg");
  });

  it("names a video as one when the picker gives nothing", () => {
    const file = imageAssetToFile(
      asset({ type: "video", mimeType: "video/mp4" }),
      AT,
    );

    expect(file.name).toBe("video-2026-09-16-033907.mp4");
  });
});
