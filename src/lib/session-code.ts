import type { SessionCode } from "./types";

const aliases: Record<string, SessionCode> = {
  fp1: "FP1",
  "practice 1": "FP1",
  "practice1": "FP1",
  "free practice 1": "FP1",
  fp2: "FP2",
  "practice 2": "FP2",
  "practice2": "FP2",
  "free practice 2": "FP2",
  fp3: "FP3",
  "practice 3": "FP3",
  "practice3": "FP3",
  "free practice 3": "FP3",
  sq: "SQ",
  "sprint qualifying": "SQ",
  "sprint shootout": "SQ",
  "sprint shoot-out": "SQ",
  sprint: "SPR",
  spr: "SPR",
  qualifying: "Q",
  q: "Q",
  race: "R",
  r: "R",
};

export function canonicalSessionCode(value: unknown): SessionCode | undefined {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return aliases[normalized];
}
