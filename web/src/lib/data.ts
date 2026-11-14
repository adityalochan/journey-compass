// The single place the website reads data from. When Tarun's DB/API lands, change only this file.
import type { Participant } from "../../../src/types";
import raw from "../../../src/data/participants.json";

export const participants = raw as unknown as Participant[];

export function findParticipant(id: string | null): Participant {
  return participants.find((p) => p.id === id) ?? participants[0];
}
