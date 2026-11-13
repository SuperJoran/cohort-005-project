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
  const tooLong = draft.length > MAX_NOTE_LENGTH;
  const empty = draft.trim().length === 0;
  const unsaved = draft !== (savedBody ?? "");

  return {
    length: draft.length,
    max: MAX_NOTE_LENGTH,
    tooLong,
    unsaved,
    // The action rejects an empty note, so an empty draft has nothing to save.
    canSave: unsaved && !empty && !tooLong,
  };
}
