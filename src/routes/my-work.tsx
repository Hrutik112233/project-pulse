import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, CheckCircle2, Gauge, Activity } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGate, MEMBER_ROLES } from "@/components/auth-gate";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { UpdateCard } from "@/components/dashboard/update-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrganisationData, STATUS_LABELS } from "@/lib/analytics";
import { fetchWorkspace, type AppRole } from "@/lib/workspace";
import { SubmitWorkDialog } from "@/components/submit-work-dialog";
import { NotificationBell } from "@/components/notification-bell";

export const Route = createFileRoute("/my-work")({
  head: () => ({
    meta: [
      { title: "My work — Northlight" },
      {
        name: "description",
        content:
          "Team member workspace: your assigned tasks, module progress and the updates you have submitted.",
      },
      { property: "og:title", content: "My work — Northlight" },
      {
        property: "og:description",
        content: "Your assigned tasks and submitted progress updates in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyWorkRoute,
});

function MyWorkRoute() {
  return (
    <AuthGate allow={MEMBER_ROLES} portal="member">
      {(user) => (
        <AppShell
          userName={user.name}
          role={user.role}
          title="My work"
          subtitle="Tasks assigned to you and your progress history"
          actions={
            <div className="flex items-center gap-2">
              <NotificationBell profileId={user.profileId} />
              <UploadWorkAction
                profileId={user.profileId}
                name={user.name}
                role={user.role as AppRole}
              />
            </div>
          }
        >
          <MyWorkBody profileId={user.profileId} />
        </AppShell>
      )}
    </AuthGate>
  );
}

function UploadWorkAction({
  profileId,
  name,
  role,
}: {
  profileId: string;
  name: string;
  role: AppRole;
}) {
  const { data } = useQuery({ queryKey: ["workspace"], queryFn: fetchWorkspace });
  const myTasks = (data?.tasks ?? []).filter(
    (t) => t.assigned_member_id === profileId || t.created_by === profileId,
  );
  return (
    <SubmitWorkDialog
      actor={{ profileId, name, role }}
      tasks={myTasks}
      projects={data?.projects ?? []}
    />
  );
}

function MyWorkBody({ profileId }: { profileId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["organisation-data"],
    queryFn: fetchOrganisationData,
  });

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;

  const projectById = new Map(data.projects.map((p) => [p.id, p]));
  const peopleById = new Map(data.people.map((p) => [p.id, p]));

  const myTasks = data.tasks.filter((t) => t.assigned_member_id === profileId);
  const myUpdates = data.updates.filter((u) => u.author_id === profileId);
  const completed = myTasks.filter((t) => t.status === "completed").length;
  const avgProgress = myTasks.length
    ? Math.round(myTasks.reduce((s, t) => s + t.progress, 0) / myTasks.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Assigned tasks" value={myTasks.length} icon={ListChecks} />
        <KpiCard label="Completed" value={completed} icon={CheckCircle2} />
        <KpiCard label="Average progress" value={`${avgProgress}%`} icon={Gauge} />
        <KpiCard label="Updates submitted" value={myUpdates.length} icon={Activity} />
      </div>

      <section className="panel p-5">
        <h2 className="font-display text-lg font-semibold">Your tasks</h2>
        {myTasks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No tasks assigned to you yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {myTasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {projectById.get(t.project_id)?.name ?? "Project"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABELS[t.status] ?? t.status}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {STATUS_LABELS[t.status] ?? t.status}
                </Badge>
                <div className="flex w-40 items-center gap-2">
                  <Progress value={t.progress} className="h-1.5" />
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                    {t.progress}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Your recent updates</h2>
        {myUpdates.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not posted any updates yet.</p>
        ) : (
          myUpdates.slice(0, 10).map((u) => (
            <UpdateCard
              key={u.id}
              item={{
                id: u.id,
                authorName: peopleById.get(u.author_id)?.full_name ?? "You",
                authorRole: "member",
                projectName: projectById.get(u.project_id)?.name ?? "Project",
                work_title: u.work_title,
                module_name: u.module_name,
                progress_from: u.progress_from,
                progress_to: u.progress_to,
                status: u.status,
                github_url: u.github_url,
                live_url: u.live_url,
                screenshots: u.screenshots,
                created_at: u.created_at,
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}
