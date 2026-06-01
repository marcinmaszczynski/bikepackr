import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response("Supabase not configured", { status: 503 });
  }

  const id = context.params.id ?? "";

  const { error: tripError } = await supabase.from("trips").select("id").eq("id", id).single();
  if (tripError) {
    return new Response("Not found", { status: 404 });
  }

  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) {
    return new Response("Delete failed", { status: 500 });
  }

  return new Response(null, { status: 204 });
};
