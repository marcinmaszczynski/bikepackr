import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const displayName = ((form.get("display_name") ?? "") as string).trim();

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/profile?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });

  if (error) {
    return context.redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/profile?success=name");
};
