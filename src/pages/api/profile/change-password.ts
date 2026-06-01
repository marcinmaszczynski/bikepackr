import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const currentPassword = (form.get("current_password") ?? "") as string;
  const newPassword = (form.get("new_password") ?? "") as string;
  const confirmNewPassword = (form.get("confirm_new_password") ?? "") as string;

  if (newPassword !== confirmNewPassword) {
    return context.redirect(`/profile?error=${encodeURIComponent("Nowe hasła nie są identyczne")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/profile?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return context.redirect(`/profile?error=${encodeURIComponent("Nie jesteś zalogowany")}`);
  }

  // Verify current password via re-auth — supabase.auth.updateUser does not check the old password.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return context.redirect(`/profile?error=${encodeURIComponent("Nieprawidłowe obecne hasło")}`);
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

  if (updateError) {
    return context.redirect(`/profile?error=${encodeURIComponent(updateError.message)}`);
  }

  return context.redirect("/profile?success=password");
};
