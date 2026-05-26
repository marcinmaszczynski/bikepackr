import type { Trip } from "@/lib/supabase";

type HardRuleContext = Pick<Trip, "accommodation_type" | "riding_philosophy">;

export interface HardRuleResult {
  excluded: string[];
  required: string[];
}

export function evaluateHardRules(context: HardRuleContext): HardRuleResult {
  const excluded: string[] = [];
  const required: string[] = [];

  if (context.accommodation_type === "hostel") {
    excluded.push("sleeping bag", "camping mattress", "tent");
    required.push("sleep sack / liner");
  }

  return { excluded, required };
}

export function buildHardRulesSection(context: HardRuleContext): string {
  const { excluded, required } = evaluateHardRules(context);
  const lines: string[] = [];

  if (excluded.length > 0) {
    lines.push(`MUST NOT include: ${excluded.join(", ")}.`);
  }
  if (required.length > 0) {
    lines.push(`MUST include: ${required.join(", ")}.`);
  }

  if (lines.length === 0) return "";
  return `\n\nHARD RULES (these override AI judgment and are absolute):\n${lines.join("\n")}`;
}
