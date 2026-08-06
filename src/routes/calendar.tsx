import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ADMIN_ROLES, AuthGate } from "@/components/auth-gate";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdateCard } from "@/components/dashboard/update-card";
import { fetchOrganisationData } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Activity calendar — Northlight" },
      {
        name: "description",
        content:
          "Monthly activity heatmap of delivery updates. Pick any day for its detailed activity report.",
      },
      { property: "og:title", content: "Activity calendar — Northlight" },
      {
        property: "og:description",
        content: "See which days the organisation shipped, and drill into any date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarRoute,
});

function CalendarRoute() {
  return (
    <AuthGate allow={ADMIN_ROLES} portal="admin">
      {(user) => (
        <AppShell
          userName={user.name}
          role={user.role}
          title="Activity calendar"
          subtitle="Daily delivery activity across the organisation"
        >
          <CalendarBoard />
        </AppShell>
      )}
    </AuthGate>
  );
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function CalendarBoard() {
  const { data, isLoading } = useQuery({
    queryKey: ["organisation-data"],
    queryFn: fetchOrganisationData,
  });
  const [selected, setSelected] = useState(isoDay(new Date()));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const leading = (monthStart.getDay() + 6) % 7;

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of data?.updates ?? []) {
      const key = isoDay(new Date(u.created_at));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [data]);

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;

  const peopleById = new Map(data.people.map((p) => [p.id, p]));
  const dayUpdates = data.updates
    .filter((u) => isoDay(new Date(u.created_at)) === selected)
    .map((u) => ({
      ...u,
      authorName: peopleById.get(u.author_id)?.full_name ?? "Unknown",
      authorRole: peopleById.get(u.author_id)?.role ?? "member",
      projectName: data.projects.find((p) => p.id === u.project_id)?.name ?? "Project",
    }));

  const activeProjects = new Set(dayUpdates.map((u) => u.project_id)).size;
  const activeUsers = new Set(dayUpdates.map((u) => u.author_id)).size;
  const screenshots = dayUpdates.reduce((s, u) => s + u.screenshots.length, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <span className="text-xs text-muted-foreground">Shade = updates logged</span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
          {Array.from({ length: leading }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(now.getFullYear(), now.getMonth(), i + 1);
            const key = isoDay(date);
            const count = byDay.get(key) ?? 0;
            const intensity =
              count === 0 ? "bg-secondary/60" : count < 2 ? "bg-primary/25" : count < 4 ? "bg-primary/55" : "bg-primary/90";
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={cn(
                  "aspect-square rounded-md border text-xs font-medium transition-colors",
                  intensity,
                  selected === key ? "border-primary" : "border-transparent hover:border-border",
                  count >= 2 ? "text-primary-foreground" : "text-foreground",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="panel p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {new Date(selected).toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Updates" value={dayUpdates.length} />
            <Stat label="Active people" value={activeUsers} />
            <Stat label="Projects touched" value={activeProjects} />
            <Stat label="Screenshots" value={screenshots} />
          </dl>
        </div>

        <div className="space-y-3">
          {dayUpdates.length === 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              No activity recorded on this date
            </Badge>
          )}
          {dayUpdates.map((u) => (
            <UpdateCard key={u.id} item={u} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
