import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Grants the signed-in user admin access when they present the organisation's
 * admin invite code. Creates/links their profile if needed.
 */
export const claimAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { inviteCode: string; fullName?: string }) => {
    const code = String(data?.inviteCode ?? "").trim();
    if (!code) throw new Error("Admin invite code is required.");
    return { inviteCode: code, fullName: String(data?.fullName ?? "").trim() };
  })
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_INVITE_CODE"];
    if (!expected) throw new Error("Admin registration is not configured.");
    if (data.inviteCode !== expected) throw new Error("Invalid admin invite code.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = String(context.claims["email"] ?? "").toLowerCase();

    const { data: linked } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let profileId = linked?.id ?? null;

    if (!profileId) {
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
        profileId = byEmail.id;
      } else {
        const { data: created, error } = await supabaseAdmin
          .from("profiles")
          .insert({
            user_id: userId,
            email,
            full_name: data.fullName || email.split("@")[0] || "New admin",
            job_title: "Project Admin",
            last_seen_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        profileId = created.id;
      }
    }

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("profile_id", profileId);

    const roles = (existing ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ profile_id: profileId, role: "admin" });
      if (error) throw new Error(error.message);
    }

    return { profileId, role: "admin" as const };
  });
