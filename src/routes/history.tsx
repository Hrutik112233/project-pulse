import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, History } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGate, STAFF_ROLES } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadCsv, downloadPdf } from "@/lib/reports";
import { fetchWorkspace, formatDateTime, nameOf, type ActivityLog } from "@/lib/workspace";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Activity history — Northlight" },
      {
        name: "description",
        content:
          "Full audit trail of task assignments, approvals, status changes, uploads and deletions.",
      },
      { property: "og:title", content: "Activity history — Northlight" },
      {
        property: "og:description",
        content: "Chronological audit log of everything that happens in the workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate allow={STAFF_ROLES} portal="admin">
      {(user) => <HistoryPage userName={user.name} role={user.role} />}
    </AuthGate>
  ),
});

const ALL = "__all__";

function HistoryPage({ userName, role }: { userName: string; role: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["workspace"], queryFn: fetchWorkspace });
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState(ALL);
  const [projectId, setProjectId] = useState(ALL);

  const logs = data?.logs ?? [];
  const people = data?.people ?? [];
  const projects = data?.projects ?? [];

  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (search && !l.action.toLowerCase().includes(search.toLowerCase())) return false;
        if (actor !== ALL && l.actor_id !== actor) return false;
        if (projectId !== ALL && l.project_id !== projectId) return false;
        return true;
      }),
    [logs, search, actor, projectId],
  );

  const columns = [
    { header: "When", value: (l: ActivityLog) => formatDateTime(l.created_at) },
    { header: "Who", value: (l: ActivityLog) => nameOf(people, l.actor_id) },
    { header: "Action", value: (l: ActivityLog) => l.action },
    {
      header: "Project",
      value: (l: ActivityLog) => projects.find((p) => p.id === l.project_id)?.name ?? "—",
    },
  ];

  return (
    <AppShell
      userName={userName}
      role={role}
      title="Activity history"
      subtitle="Complete audit trail across projects, tasks and users"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv("activity-history", columns, filtered)}
          >
            <Download className="size-4" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPdf("Activity history", columns, filtered)}
          >
            <Download className="size-4" /> PDF
          </Button>
        </div>
      }
    >
      {isLoading || !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-4">
          <div className="panel flex flex-wrap items-center gap-2 p-3">
            <Input
              placeholder="Search actions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full sm:w-64"
            />
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Everyone</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} events
            </span>
          </div>

          <ol className="panel space-y-0 p-2">
            {filtered.map((log) => (
              <li
                key={log.id}
                className="flex gap-3 border-b border-border/60 p-3 last:border-0"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <History className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{nameOf(people, log.actor_id)}</span>{" "}
                    <span className="text-muted-foreground">{log.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)}
                    {log.project_id &&
                      ` · ${projects.find((p) => p.id === log.project_id)?.name ?? "project"}`}
                  </p>
                </div>
              </li>
            ))}
            {!filtered.length && (
              <li className="py-10 text-center text-muted-foreground">No activity recorded yet.</li>
            )}
          </ol>
        </div>
      )}
    </AppShell>
  );
}
