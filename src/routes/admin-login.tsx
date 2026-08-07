import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { claimAdminAccess } from "@/lib/registration.functions";

const PENDING_CODE_KEY = "northlight.pending-admin-code";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin sign in — Northlight Project Control" },
      {
        name: "description",
        content:
          "Restricted admin portal sign in and admin account registration for Northlight super admins and project admins.",
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

async function isAdminUser(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("profile_id", profile?.id ?? "");
  return (roles ?? []).some((r) => r.role === "super_admin" || r.role === "admin");
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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

    let admin = await isAdminUser(data.user.id);

    // Finish a registration that was waiting on email confirmation.
    const pending = window.localStorage.getItem(PENDING_CODE_KEY);
    if (!admin && pending) {
      try {
        await claimAdminAccess({ data: { inviteCode: pending, fullName } });
        window.localStorage.removeItem(PENDING_CODE_KEY);
        admin = true;
      } catch {
        window.localStorage.removeItem(PENDING_CODE_KEY);
      }
    }

    setBusy(false);

    if (!admin) {
      await supabase.auth.signOut();
      toast.error("This account does not have admin access. Use the team member sign in.");
      return;
    }

    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin-login`,
        data: { full_name: fullName },
      },
    });

    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    if (!data.session) {
      window.localStorage.setItem(PENDING_CODE_KEY, inviteCode);
      setBusy(false);
      toast.success("Confirm your email, then sign in here to activate admin access.");
      setMode("signin");
      return;
    }

    try {
      await claimAdminAccess({ data: { inviteCode, fullName } });
      setBusy(false);
      toast.success("Admin account created.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setBusy(false);
      await supabase.auth.signOut();
      toast.error(err instanceof Error ? err.message : "Could not grant admin access.");
    }
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
          <h1 className="font-display text-2xl font-semibold">Administrator access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin accounts only. Team members use the{" "}
            <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
              team portal
            </Link>
            .
          </p>

          <Tabs value={mode} onValueChange={setMode} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create admin ID</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 pt-4">
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
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Full name</Label>
                  <Input
                    id="admin-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Morgan"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-signup-email">Admin email</Label>
                  <Input
                    id="admin-signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-signup-password">Password</Label>
                  <Input
                    id="admin-signup-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-invite">Admin invite code</Label>
                  <Input
                    id="admin-invite"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Provided by your super admin"
                  />
                  <p className="text-xs text-muted-foreground">
                    Admin rights are only granted when this code matches your organisation's code.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />} Create admin account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
