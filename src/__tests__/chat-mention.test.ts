import { mentionsAssistant, splitMention } from "@/lib/chat/mention";

describe("mentionsAssistant", () => {
  it.each([
    "@folio",
    "@Folio",
    "@FOLIO can you help?",
    "hi @folio there",
    "hi @folio, there",
    "hi\n@folio",
  ])("detects the token in %j", (text) => {
    expect(mentionsAssistant(text)).toBe(true);
  });

  it.each([
    "",
    "no mention here",
    "email@folio.com",
    "@folioX is not the assistant",
    "folio without the at sign",
  ])("does not false-positive on %j", (text) => {
    expect(mentionsAssistant(text)).toBe(false);
  });
});

describe("splitMention", () => {
  it("returns a single plain segment when there is no mention", () => {
    expect(splitMention("no mention here")).toEqual([
      { text: "no mention here", mention: false },
    ]);
  });

  it("returns a single plain segment for an empty string", () => {
    expect(splitMention("")).toEqual([{ text: "", mention: false }]);
  });

  it("splits a mention in the middle, preserving surrounding text", () => {
    expect(splitMention("hi @folio there")).toEqual([
      { text: "hi ", mention: false },
      { text: "@folio", mention: true },
      { text: " there", mention: false },
    ]);
  });

  it("handles a mention at the very start", () => {
    expect(splitMention("@folio please help")).toEqual([
      { text: "@folio", mention: true },
      { text: " please help", mention: false },
    ]);
  });

  it("handles a mention at the very end", () => {
    expect(splitMention("hey @folio")).toEqual([
      { text: "hey ", mention: false },
      { text: "@folio", mention: true },
    ]);
  });

  it("preserves the mention's original casing", () => {
    expect(splitMention("hi @Folio")).toEqual([
      { text: "hi ", mention: false },
      { text: "@Folio", mention: true },
    ]);
  });

  it("splits every occurrence when the mention appears more than once", () => {
    expect(splitMention("@folio and @folio again")).toEqual([
      { text: "@folio", mention: true },
      { text: " and ", mention: false },
      { text: "@folio", mention: true },
      { text: " again", mention: false },
    ]);
  });

  it("does not treat an email-like token as a mention", () => {
    expect(splitMention("contact me@folio.com please")).toEqual([
      { text: "contact me@folio.com please", mention: false },
    ]);
  });
});
