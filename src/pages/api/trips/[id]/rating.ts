import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const ALLOWED_FIELDS = ["pre_trip_rating", "post_trip_rating"] as const;
type RatingField = (typeof ALLOWED_FIELDS)[number];

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response("Supabase not configured", { status: 503 });
  }

  const tripId = context.params.id ?? "";

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return new Response("Invalid request body", { status: 400 });
  }

  const bodyRecord = body as Record<string, unknown>;
  const field: RatingField | undefined = ALLOWED_FIELDS.find((f) => f in bodyRecord);
  const value = field ? bodyRecord[field] : undefined;

  if (!field || typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 6) {
    return new Response("Invalid rating field or value", { status: 400 });
  }

  const { data, error } = await supabase
    .from("trips")
    .update({ [field]: value })
    .eq("id", tripId)
    .select("pre_trip_rating, post_trip_rating")
    .single();

  if (error) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(data);
};
