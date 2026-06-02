import { describe, it, expect } from "vitest";
import { evaluateHardRules } from "@/lib/hard-rules";

// Oracle: PRD §Business Logic — "reguły sztywne są nadrzędne wobec sugestii kontekstowych"
// PRD §AC US-01 — "np. nocleg w schronisku → liner do śpiwora zamiast śpiwora"
// Combinations T1–T6 from research.md covering all 3 rule branches.
const cases = [
  {
    name: "T1: hostel + expedition — hostel branch only",
    accommodation_type: "hostel",
    riding_philosophy: "expedition",
    required: ["wkład do śpiwora / prześcieradło turystyczne"],
    excluded: ["śpiwór", "karimat / mata do spania", "namiot"],
  },
  {
    name: "T2: hostel + fast_and_light — hostel + fast_and_light combined",
    accommodation_type: "hostel",
    riding_philosophy: "fast_and_light",
    required: ["wkład do śpiwora / prześcieradło turystyczne"],
    excluded: ["śpiwór", "karimat / mata do spania", "namiot", "krzesło campingowe", "stolik campingowy"],
  },
  {
    name: "T3: tent + expedition — outdoor branch only",
    accommodation_type: "tent",
    riding_philosophy: "expedition",
    required: ["śpiwór", "karimat / mata do spania"],
    excluded: [],
  },
  {
    name: "T4: tent + fast_and_light — outdoor + fast_and_light combined",
    accommodation_type: "tent",
    riding_philosophy: "fast_and_light",
    required: ["śpiwór", "karimat / mata do spania"],
    excluded: ["krzesło campingowe", "stolik campingowy"],
  },
  {
    name: "T5: hammock + fast_and_light — hammock outdoor branch",
    accommodation_type: "hammock",
    riding_philosophy: "fast_and_light",
    required: ["śpiwór", "karimat / mata do spania"],
    excluded: ["krzesło campingowe", "stolik campingowy"],
  },
  {
    name: "T6: bivy + expedition — bivy outdoor branch, no fast_and_light",
    accommodation_type: "bivy",
    riding_philosophy: "expedition",
    required: ["śpiwór", "karimat / mata do spania"],
    excluded: [],
  },
] as const;

describe("evaluateHardRules — R2 hard-rules regression", () => {
  it.each(cases)("$name", ({ accommodation_type, riding_philosophy, required, excluded }) => {
    const result = evaluateHardRules({ accommodation_type, riding_philosophy });

    expect(result.required).toEqual(required);
    expect(result.excluded).toEqual(excluded);
  });
});
