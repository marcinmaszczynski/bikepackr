import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response("Supabase not configured", { status: 503 });
  }

  const tripId = context.params.id ?? "";
  const itemId = context.params.itemId ?? "";

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).is_packed !== "boolean") {
    return new Response("Missing required field: is_packed (boolean)", { status: 400 });
  }

  const { is_packed } = body as { is_packed: boolean };

  const { data, error } = await supabase
    .from("checklist_items")
    .update({ is_packed })
    .eq("trip_id", tripId)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(data);
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response("Supabase not configured", { status: 503 });
  }

  const tripId = context.params.id ?? "";
  const itemId = context.params.itemId ?? "";

  const { data: _data, error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("trip_id", tripId)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, { status: 204 });
};
