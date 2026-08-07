import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, LEADER_ROLES } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { NotificationBell } from "@/components/notification-bell";
import { CompletionBar, PriorityBadge, StatusBadge } from "@/components/task-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  effectiveStatus,
  fetchWorkspace,
  formatDate,
  nameOf,
  taskStats,
} from "@/lib/workspace";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team leader portal — Northlight" },
      {
        name: "description",
        content:
          "Team leader dashboard: team members, assigned tasks, completion rates and delivery performance.",
      },
      { property: "og:title", content: "Team leader portal — Northlight" },
      {
        property: "og:description",
        content: "Monitor your team's tasks, progress and completion in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate allow={LEADER_ROLES} portal="member">
      {(user) => <TeamPortal profileId={user.profileId} name={user.name} role={user.role} />}
    </AuthGate>
  ),
});

function TeamPortal({
  profileId,
  name,
  role,
}: {
  profileId: string;
  name: string;
  role: string;
}) {
  const { data, isLoading } = useQuery({ queryKey: ["workspace"], queryFn: fetchWorkspace });

  const people = data?.people ?? [];
  const me = people.find((p) => p.id === profileId);
  const team = (data?.teams ?? []).find((t) => t.leader_id === profileId || t.id === me?.team_id);
  const members = people.filter((p) => p.team_id && p.team_id === team?.id && p.id !== profileId);
  const memberIds = new Set([...members.map((m) => m.id), profileId]);

  const teamTasks = (data?.tasks ?? []).filter(
    (t) =>
      t.team_leader_id === profileId ||
      (t.assigned_member_id && memberIds.has(t.assigned_member_id)),
  );
  const stats = taskStats(teamTasks);
  const projectIds = new Set(teamTasks.map((t) => t.project_id));

  return (
    <AppShell
      userName={name}
      role={role}
      title={team?.name ?? "My team"}
      subtitle="Team delivery, assignments and performance"
      actions={<NotificationBell profileId={profileId} />}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading team data…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Team members", members.length],
              ["Projects", projectIds.size],
              ["Total tasks", stats.total],
              ["Completed", stats.completed],
              ["Pending", stats.pending],
              ["Overdue", stats.overdue],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="pt-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team completion</CardTitle>
            </CardHeader>
            <CardContent>
              <CompletionBar value={stats.completion} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team members</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead className="w-48">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No team members yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {members.map((m) => {
                    const own = teamTasks.filter((t) => t.assigned_member_id === m.id);
                    const s = taskStats(own);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.full_name}</TableCell>
                        <TableCell>{s.total}</TableCell>
                        <TableCell>{s.completed}</TableCell>
                        <TableCell>{s.pending}</TableCell>
                        <TableCell>
                          <CompletionBar value={s.completion} showLabel={false} />
                          <span className="text-xs text-muted-foreground">{s.completion}%</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team tasks</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamTasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No tasks for your team yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {teamTasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell>{nameOf(people, t.assigned_member_id)}</TableCell>
                      <TableCell>
                        <PriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={effectiveStatus(t)} />
                      </TableCell>
                      <TableCell>{formatDate(t.due_date)}</TableCell>
                      <TableCell className="w-40">
                        <CompletionBar value={t.progress} showLabel={false} />
                        <span className="text-xs text-muted-foreground">{t.progress}%</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
