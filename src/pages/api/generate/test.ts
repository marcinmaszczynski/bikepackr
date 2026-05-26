import type { APIRoute } from "astro";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "astro:env/server";

export const POST: APIRoute = async (context) => {
  if (!ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 503 });
  }

  const body = (await context.request.json()) as unknown as { prompt?: string };
  const userPrompt =
    typeof body.prompt === "string"
      ? body.prompt
      : "List 10 essential items for a 3-day bikepacking trip in a tent. Be concise.";

  const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: "You are a bikepacking gear expert. Be practical and concise.",
    prompt: userPrompt,
  });

  return result.toTextStreamResponse();
};
