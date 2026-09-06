/**
 * Worker-side guard before sending an attendance edit.
 *
 * The backend accepts any proposal on a validated day and re-notifies the managers each
 * time, so the app refuses two useless submissions up front:
 * - `unchanged`: the proposal equals what the day already holds (for a validated day that is
 *   exactly the request the manager has already validated);
 * - `duplicate_request`: a change request with these same values is already waiting.
 */

import type { LaborEntry, ShiftType } from "@/features/labor/labor-types";

export interface OwnEditProposal {
  shift_type: ShiftType | null;
  supplement_hours: number;
  note: string | null;
}

export type OwnEditVerdict = "ok" | "unchanged" | "duplicate_request";

type EntryLike = Pick<
  LaborEntry,
  | "shift_type"
  | "supplement_hours"
  | "note"
  | "change_requested_at"
  | "proposed_shift_type"
  | "proposed_supplement_hours"
  | "proposed_note"
>;

/** Empty or whitespace-only notes compare equal to no note. */
function normalizeNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function sameValues(
  proposal: OwnEditProposal,
  shift: ShiftType | null | undefined,
  hours: number | null | undefined,
  note: string | null | undefined,
): boolean {
  return (
    proposal.shift_type === (shift ?? null) &&
    proposal.supplement_hours === (hours ?? 0) &&
    normalizeNote(proposal.note) === normalizeNote(note)
  );
}

export function classifyOwnEdit(
  entry: EntryLike,
  proposal: OwnEditProposal,
): OwnEditVerdict {
  if (
    entry.change_requested_at &&
    sameValues(
      proposal,
      entry.proposed_shift_type,
      entry.proposed_supplement_hours,
      entry.proposed_note,
    )
  )
    return "duplicate_request";
  if (
    sameValues(proposal, entry.shift_type, entry.supplement_hours, entry.note)
  )
    return "unchanged";
  return "ok";
}
