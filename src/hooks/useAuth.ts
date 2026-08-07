import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile } from "@/lib/session.functions";

export type AppRole = "super_admin" | "admin" | "team_leader" | "member";

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

const RANK: Record<string, number> = { super_admin: 4, admin: 3, team_leader: 2, member: 1 };

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

      const role = ((roles ?? []).map((r) => r.role as AppRole).sort(
        (a, b) => (RANK[b] ?? 0) - (RANK[a] ?? 0),
      )[0] ?? "member") as AppRole;

      return { profile, role };
    },
  });
}
