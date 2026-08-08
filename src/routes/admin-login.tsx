import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn() {
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

  async function handleSignUp() {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") await handleSignIn();
    else await handleSignUp();
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
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="bg-gradient-amber grid size-8 place-items-center rounded-md font-display text-sm font-bold text-primary-foreground">
            N
          </span>
          <span className="font-display text-lg font-semibold">Northlight</span>
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> Admin portal
          </div>
          <h1 className="font-display text-2xl font-semibold">Administrator access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in with your admin account." : "Register a new admin ID."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === "signin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create admin ID
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === "signup" && (
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
            )}

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
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
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
                  Admin rights are granted only when this code matches your organisation's code.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Enter admin portal" : "Create admin account"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleReset}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary underline-offset-4 hover:underline"
            >
              {mode === "signin" ? "Create admin ID" : "Back to sign in"}
            </button>
          </div>
        </div>

        <Link
          to="/auth"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          <Users className="size-4 text-primary" /> Team member? Go to team portal
        </Link>

        <Link
          to="/"
          className="mt-3 block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
