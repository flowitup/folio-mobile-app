import {
  MAX_RECORDING_MS,
  formatClock,
  isVoiceNote,
  playbackFraction,
  voiceNoteFilename,
} from "@/lib/chat/voice-note";

describe("isVoiceNote", () => {
  // The API stores whatever the recording device reported, so every spelling must pass.
  it.each([
    "audio/m4a",
    "audio/x-m4a",
    "audio/mp4",
    "audio/mp4a-latm",
    "audio/aac",
    "AUDIO/MPEG",
  ])("treats %s as a voice note", (contentType) => {
    expect(isVoiceNote(contentType)).toBe(true);
  });

  it.each(["image/jpeg", "image/png", "video/mp4", "application/pdf", ""])(
    "leaves %s to the image branch",
    (contentType) => {
      expect(isVoiceNote(contentType)).toBe(false);
    },
  );
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [900, "0:00"],
    [1_000, "0:01"],
    [59_999, "0:59"],
    [60_000, "1:00"],
    [125_400, "2:05"],
    [MAX_RECORDING_MS, "5:00"],
  ])("renders %ims as %s", (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });

  it("reads a missing or negative position as zero", () => {
    expect(formatClock(-5_000)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});

describe("playbackFraction", () => {
  it("is the share of the note already played", () => {
    expect(playbackFraction(3_000, 12_000)).toBe(0.25);
  });

  it("stays inside 0..1 when the player overshoots or has no duration yet", () => {
    expect(playbackFraction(13_000, 12_000)).toBe(1);
    expect(playbackFraction(-1, 12_000)).toBe(0);
    expect(playbackFraction(3_000, 0)).toBe(0);
    expect(playbackFraction(3_000, Number.NaN)).toBe(0);
  });
});

describe("voiceNoteFilename", () => {
  it("names the upload after the moment it was recorded, as m4a", () => {
    expect(voiceNoteFilename(new Date("2026-09-12T00:30:00Z"))).toBe(
      `voice-${new Date("2026-09-12T00:30:00Z").getTime()}.m4a`,
    );
  });
});

describe("MAX_RECORDING_MS", () => {
  // 10 MB is the API attachment cap; the length cap exists to stay well inside it.
  it("is five minutes", () => {
    expect(MAX_RECORDING_MS).toBe(300_000);
  });
});
