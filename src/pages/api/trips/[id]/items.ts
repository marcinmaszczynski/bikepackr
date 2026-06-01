import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
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

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).name !== "string" ||
    typeof (body as Record<string, unknown>).category !== "string"
  ) {
    return new Response("Missing required fields: name, category", { status: 400 });
  }

  const { name, category } = body as { name: string; category: string };

  if (name.trim() === "" || category.trim() === "") {
    return new Response("name and category must be non-empty", { status: 400 });
  }

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      trip_id: id,
      name: name.trim(),
      category: category.trim(),
      source: "user",
    })
    .select()
    .single();

  if (error) {
    return new Response("Insert failed", { status: 500 });
  }

  return Response.json(data, { status: 201 });
};
