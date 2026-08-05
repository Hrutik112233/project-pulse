import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrganisationData } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "People — Northlight" },
      {
        name: "description",
        content:
          "Directory of super admins, admins and team members with department, role and presence status.",
      },
      { property: "og:title", content: "People — Northlight" },
      {
        property: "og:description",
        content: "Who is in the organisation, what they own and whether they are online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PeopleRoute,
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  member: "Team Member",
};

function presenceOf(lastSeen: string | null) {
  if (!lastSeen) return { label: "Offline", tone: "bg-muted-foreground" };
  const mins = (Date.now() - new Date(lastSeen).getTime()) / 60000;
  if (mins < 15) return { label: "Online", tone: "bg-success" };
  if (mins < 120) return { label: "Idle", tone: "bg-warning" };
  return { label: "Offline", tone: "bg-muted-foreground" };
}

function PeopleRoute() {
  return (
    <AuthGate>
      {(user) => (
        <AppShell
          userName={user.name}
          role={user.role}
          title="People"
          subtitle="Admins and team members across the organisation"
        >
          <PeopleGrid />
        </AppShell>
      )}
    </AuthGate>
  );
}

function PeopleGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ["organisation-data"],
    queryFn: fetchOrganisationData,
  });

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.people.map((person) => {
        const presence = presenceOf(person.last_seen_at);
        const initials = person.full_name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        return (
          <div key={person.id} className="panel flex items-start gap-3 p-4">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{person.full_name}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {ROLE_LABEL[person.role]}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {person.job_title ?? "—"} · {person.department ?? "—"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{person.email}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", presence.tone)} />
                {presence.label}
                {!person.is_active && <span className="ml-auto">Deactivated</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
