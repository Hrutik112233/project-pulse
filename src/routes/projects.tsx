import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ADMIN_ROLES, AuthGate } from "@/components/auth-gate";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchOrganisationData, STATUS_LABELS } from "@/lib/analytics";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Northlight" },
      {
        name: "description",
        content:
          "Every project in the organisation with client, category, priority, status, progress and deadline.",
      },
      { property: "og:title", content: "Projects — Northlight" },
      {
        property: "og:description",
        content: "Portfolio view of all projects with live progress and deadlines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsRoute,
});

const PRIORITY_TONE: Record<string, string> = {
  critical: "border-destructive/50 text-destructive",
  high: "border-primary/50 text-primary",
  medium: "border-border text-muted-foreground",
  low: "border-border text-muted-foreground",
};

function ProjectsRoute() {
  return (
    <AuthGate allow={ADMIN_ROLES} portal="admin">
      {(user) => (
        <AppShell
          userName={user.name}
          role={user.role}
          title="Projects"
          subtitle="Portfolio-wide delivery status"
        >
          <ProjectsTable />
        </AppShell>
      )}
    </AuthGate>
  );
}

function ProjectsTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["organisation-data"],
    queryFn: fetchOrganisationData,
  });

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="panel overflow-x-auto p-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-56">Progress</TableHead>
            <TableHead>Deadline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-muted-foreground">{p.client_name ?? "Internal"}</TableCell>
              <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={PRIORITY_TONE[p.priority]}>
                  {p.priority}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{STATUS_LABELS[p.status]}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={p.progress} className="h-1.5" />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {p.progress}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
