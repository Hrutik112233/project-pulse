import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCurrentProfile, useSession, type AppRole } from "@/hooks/useAuth";

export type GatedUser = { profileId: string; name: string; role: AppRole };

export function AuthGate({ children }: { children: (user: GatedUser) => ReactNode }) {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const { data, isLoading } = useCurrentProfile(session);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session || isLoading || !data?.profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {children({
        profileId: data.profile.id,
        name: data.profile.full_name,
        role: data.role,
      })}
    </>
  );
}
