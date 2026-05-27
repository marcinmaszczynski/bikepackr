import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response("Supabase not configured", { status: 503 });
  }

  const id = context.params.id ?? "";

  const { data: trip, error: tripError } = await supabase.from("trips").select("id").eq("id", id).single();
  if (tripError || !trip) {
    return new Response("Not found", { status: 404 });
  }

  const { count, error } = await supabase
    .from("checklist_items")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", id);

  if (error) {
    return new Response("Query failed", { status: 500 });
  }

  return Response.json({ count: count ?? 0 });
};
