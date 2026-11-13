import { describe, it, expect } from "vitest";
import { noteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("noteDraft", () => {
  it("counts characters against the note limit", () => {
    const draft = noteDraft("hello", null);
    expect(draft.length).toBe(5);
    expect(draft.max).toBe(MAX_NOTE_LENGTH);
  });

  it("can save a new note with text in it", () => {
    expect(noteDraft("first thought", null)).toMatchObject({
      unsaved: true,
      canSave: true,
      tooLong: false,
    });
  });

  it("cannot save an empty or whitespace-only draft", () => {
    expect(noteDraft("", null).canSave).toBe(false);
    expect(noteDraft("   \n", null).canSave).toBe(false);
    expect(noteDraft("   \n", "saved")).toMatchObject({
      unsaved: true,
      canSave: false,
    });
  });

  it("cannot save a draft identical to the saved note", () => {
    expect(noteDraft("same", "same")).toMatchObject({
      unsaved: false,
      canSave: false,
    });
  });

  it("can save an edit to the saved note", () => {
    expect(noteDraft("same, but more", "same")).toMatchObject({
      unsaved: true,
      canSave: true,
    });
  });

  it("allows exactly the limit and rejects one over", () => {
    const atLimit = noteDraft("a".repeat(MAX_NOTE_LENGTH), null);
    expect(atLimit).toMatchObject({ tooLong: false, canSave: true });

    const overLimit = noteDraft("a".repeat(MAX_NOTE_LENGTH + 1), null);
    expect(overLimit).toMatchObject({ tooLong: true, canSave: false });
  });

  it("treats no saved note as an empty one", () => {
    expect(noteDraft("", null).unsaved).toBe(false);
  });

  it("compares and counts the draft as the action saves it, trimmed", () => {
    expect(noteDraft("idea \n", "idea")).toMatchObject({
      unsaved: false,
      canSave: false,
    });
    const atLimit = noteDraft(`${"a".repeat(MAX_NOTE_LENGTH)}\n`, null);
    expect(atLimit).toMatchObject({
      length: MAX_NOTE_LENGTH,
      tooLong: false,
      canSave: true,
    });
  });
});
