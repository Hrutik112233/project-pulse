import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Links the signed-in auth user to a profile row.
 * Seeded profiles are matched by email; otherwise a new member profile is created.
 */
export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = String(context.claims["email"] ?? "").toLowerCase();
    const metadata = (context.claims["user_metadata"] ?? {}) as Record<string, unknown>;
    const fullName = String(metadata["full_name"] ?? email.split("@")[0] ?? "New user");

    const { data: linked } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (linked) return { profileId: linked.id };

    const { data: byEmail } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (byEmail) {
      await supabaseAdmin
        .from("profiles")
        .update({ user_id: userId, last_seen_at: new Date().toISOString() })
        .eq("id", byEmail.id);
      return { profileId: byEmail.id };
    }

    const { data: created, error } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userId,
        email,
        full_name: fullName,
        last_seen_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").insert({ profile_id: created.id, role: "member" });

    return { profileId: created.id };
  });
