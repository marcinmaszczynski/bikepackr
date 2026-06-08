import type { APIRoute } from "astro";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "astro:env/server";
import { createClient } from "@/lib/supabase";
import { buildHardRulesSection } from "@/lib/hard-rules";
import { parseMarkdownToItems } from "@/lib/checklist-parser";

const ACCOMMODATION_LABELS: Record<string, string> = {
  hotel: "Hotel / pensjonat",
  tent: "Namiot",
  hammock: "Hamak",
  bivy: "Bivy bag",
  hostel: "Hostel / schronisko",
};

const PHILOSOPHY_LABELS: Record<string, string> = {
  fast_and_light: "Fast & Light (lekko i szybko)",
  expedition: "Ekspedycyjny",
};

function getSeason(dateStr: string): string {
  const month = new Date(dateStr).getMonth() + 1;
  if (month === 12 || month <= 2) return "zima";
  if (month <= 5) return "wiosna";
  if (month <= 8) return "lato";
  return "jesień";
}

const VALID_ACCOMMODATION = ["hotel", "tent", "hammock", "bivy", "hostel"];
const VALID_PHILOSOPHY = ["fast_and_light", "expedition"];

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { accommodation_type, riding_philosophy, region, start_date, trip_duration_days, title } = body;

  if (
    typeof accommodation_type !== "string" ||
    !VALID_ACCOMMODATION.includes(accommodation_type) ||
    typeof riding_philosophy !== "string" ||
    !VALID_PHILOSOPHY.includes(riding_philosophy) ||
    typeof region !== "string" ||
    !region.trim() ||
    typeof start_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
    typeof trip_duration_days !== "number" ||
    trip_duration_days < 1
  ) {
    return new Response("Missing or invalid fields", { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response("Supabase not configured", { status: 503 });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response("AI not configured", { status: 503 });
  }

  const { data: tripData, error: tripError } = await supabase
    .from("trips")
    .insert({
      user_id: context.locals.user.id,
      accommodation_type,
      riding_philosophy,
      region,
      start_date,
      trip_duration_days,
      title: typeof title === "string" && title.trim() ? title.trim() : null,
      flew_by_plane: false,
    })
    .select("id")
    .single();

  if (tripError) {
    return new Response("Failed to create trip", { status: 500 });
  }

  const tripId = tripData.id;
  const hardRulesSection = buildHardRulesSection({ accommodation_type, riding_philosophy });
  const season = getSeason(start_date);

  const systemPrompt = `Jesteś ekspertem od bikepacking. Generujesz checklisty ekwipunku po polsku.

FORMAT:
Grupuj pozycje według kategorii używając "## Nazwa kategorii".
Każda pozycja zaczyna się od "- ".
Tylko lista — bez wstępu, podsumowania ani wyjaśnień.
Minimum 10 pozycji łącznie.${hardRulesSection}`;

  const userPrompt = `Kontekst wyjazdu:
- Nocleg: ${ACCOMMODATION_LABELS[accommodation_type] ?? accommodation_type}
- Filozofia jazdy: ${PHILOSOPHY_LABELS[riding_philosophy] ?? riding_philosophy}
- Region: ${region}
- Pora roku: ${season}
- Czas trwania: ${String(trip_duration_days)} dni`;

  const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    prompt: userPrompt,
    onFinish: ({ text }) => {
      const items = parseMarkdownToItems(text);
      context.locals.cfContext.waitUntil(
        Promise.resolve(supabase
          .from("checklist_items")
          .insert(
            items.map((item) => ({ trip_id: tripId, name: item.name, category: item.category, source: "ai" as const })),
          )
          .then(({ error }) => {
            if (error) console.error("checklist_items insert failed", error);
          })),
      );
    },
  });

  const streamResponse = result.toTextStreamResponse();
  return new Response(streamResponse.body, {
    headers: {
      ...Object.fromEntries(streamResponse.headers.entries()),
      "X-Trip-Id": tripId,
    },
  });
};
