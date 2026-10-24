import type { Fact } from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);

// add a fact, or strengthen the one with the same key
export function upsert(facts: Fact[], f: Omit<Fact, "id">): Fact[] {
  const i = facts.findIndex((x) => x.key === f.key);
  if (i === -1) return [{ ...f, id: uid(), isNew: true }, ...facts];
  const old = facts[i];
  const next = { ...old, ...f, id: old.id, confidence: Math.min(1, Math.max(old.confidence, f.confidence) + 0.05) };
  return facts.map((x, j) => (j === i ? next : x));
}
