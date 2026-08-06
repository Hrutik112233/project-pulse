import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin sign in — Northlight Project Control" },
      {
        name: "description",
        content:
          "Restricted admin portal sign in for Northlight super admins and project admins.",
      },
      { property: "og:title", content: "Admin sign in — Northlight" },
      {
        property: "og:description",
        content: "Restricted access to organisation-wide project analytics and administration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setBusy(false);
      toast.error(error?.message ?? "Sign in failed.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("profile_id", profile?.id ?? "");

    const isAdmin = (roles ?? []).some((r) => r.role === "super_admin" || r.role === "admin");
    setBusy(false);

    if (!isAdmin) {
      await supabase.auth.signOut();
      toast.error("This account does not have admin access. Use the team member sign in.");
      return;
    }

    navigate({ to: "/dashboard", replace: true });
  }

  async function handleReset() {
    if (!email) {
      toast.error("Enter your admin email first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset link sent.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-sidebar p-10 lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="bg-gradient-amber grid size-8 place-items-center rounded-md font-display text-sm font-bold text-primary-foreground">
            N
          </span>
          <span className="font-display text-lg font-semibold">Northlight</span>
        </Link>
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight">
            Admin <span className="text-gradient-amber">control centre</span> for the whole
            portfolio.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Organisation analytics, project ownership, people management and delivery reporting —
            restricted to super admins and project admins.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Restricted module · RBAC enforced</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> Admin portal
          </div>
          <h1 className="font-display text-2xl font-semibold">Administrator sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin accounts only. Team members sign in on the{" "}
            <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
              team portal
            </Link>
            .
          </p>

          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin email</Label>
              <Input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Enter admin portal
            </Button>
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot your password?
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
