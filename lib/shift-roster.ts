import type { Shift, SlotAvailability } from "./registration";

export type RosterVolunteer = { id: string; firstName: string; lastName: string; shifts: Shift[] };
export const slotKey = (shift: Shift) => `${shift.store}-${shift.hour}`;
const collator = new Intl.Collator("it", { sensitivity: "base", numeric: true });

export function buildRoster(volunteers: RosterVolunteer[]) {
  const roster = new Map<string, RosterVolunteer[]>();
  const sorted = [...volunteers].sort((a, b) => collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName) || a.id.localeCompare(b.id));
  for (const volunteer of sorted) {
    for (const shift of volunteer.shifts) {
      const key = slotKey(shift);
      const people = roster.get(key) || [];
      people.push(volunteer);
      roster.set(key, people);
    }
  }
  return roster;
}

export function coverageState(slot: SlotAvailability) {
  if (slot.booked === 0) return "empty";
  return slot.capacity !== null && slot.capacity > 0 && slot.booked >= slot.capacity ? "full" : "partial";
}
