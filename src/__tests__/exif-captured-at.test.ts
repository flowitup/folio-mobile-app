import type * as ImagePicker from "expo-image-picker";

import { exifCapturedAt, imageAssetToFile } from "@/lib/files/pick";

const NOW = new Date("2026-10-16T12:00:00Z");

/**
 * The picker re-encodes a photo, which can drop its EXIF date, so photos were filed under the
 * upload day. The picker's own EXIF read gives the capture date to send with the upload.
 */
describe("reading the capture date from a picked photo's EXIF", () => {
  it("uses the camera's offset when it wrote one", () => {
    expect(
      exifCapturedAt(
        {
          DateTimeOriginal: "2026:10:14 09:12:33",
          OffsetTimeOriginal: "+07:00",
        },
        NOW,
      ),
    ).toBe("2026-10-14T02:12:33.000Z");
  });

  it("reads a date without offset as device-local time", () => {
    expect(
      exifCapturedAt({ DateTimeOriginal: "2026:10:14 09:12:33" }, NOW),
    ).toBe(new Date(2026, 9, 14, 9, 12, 33).toISOString());
  });

  it("falls back to DateTimeDigitized and DateTime", () => {
    expect(exifCapturedAt({ DateTime: "2026:01:02 03:04:05" }, NOW)).toBe(
      new Date(2026, 0, 2, 3, 4, 5).toISOString(),
    );
  });

  it("ignores missing, unreadable, ancient or future dates", () => {
    expect(exifCapturedAt(undefined, NOW)).toBeUndefined();
    expect(exifCapturedAt({}, NOW)).toBeUndefined();
    expect(
      exifCapturedAt({ DateTimeOriginal: "0000:00:00 00:00:00" }, NOW),
    ).toBeUndefined();
    expect(
      exifCapturedAt({ DateTimeOriginal: "garbage" }, NOW),
    ).toBeUndefined();
    expect(
      exifCapturedAt({ DateTimeOriginal: "2027:01:01 00:00:00" }, NOW),
    ).toBeUndefined();
  });

  it("puts the date on the picked file", () => {
    const file = imageAssetToFile(
      {
        uri: "file:///cache/x",
        width: 1,
        height: 1,
        mimeType: "image/jpeg",
        exif: {
          DateTimeOriginal: "2026:10:14 09:12:33",
          OffsetTimeOriginal: "Z",
        },
      } as ImagePicker.ImagePickerAsset,
      NOW,
    );
    // "Z" is not a "+hh:mm" offset: read as device-local time.
    expect(file.capturedAt).toBe(
      new Date(2026, 9, 14, 9, 12, 33).toISOString(),
    );
  });
});
