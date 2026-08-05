import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile } from "@/lib/session.functions";

export type AppRole = "super_admin" | "admin" | "member";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function useCurrentProfile(session: Session | null) {
  return useQuery({
    queryKey: ["current-profile", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      await ensureProfile({ data: undefined });
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("profile_id", profile?.id ?? "");

      const roleList = (roles ?? []).map((r) => r.role as AppRole);
      const role: AppRole = roleList.includes("super_admin")
        ? "super_admin"
        : roleList.includes("admin")
          ? "admin"
          : "member";

      return { profile, role };
    },
  });
}
