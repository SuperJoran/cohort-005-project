import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  max: number;
  tooLong: boolean;
  unsaved: boolean;
  canSave: boolean;
};

export function describeDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  // The action trims before it saves, so judge the draft as it will be stored.
  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_NOTE_LENGTH;
  const empty = trimmed.length === 0;
  const unsaved = trimmed !== (savedBody ?? "");

  return {
    length: trimmed.length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    unsaved,
    // The action rejects an empty note, so an empty draft has nothing to save.
    canSave: unsaved && !empty && !tooLong,
  };
}
