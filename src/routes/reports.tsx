import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { ADMIN_ROLES, AuthGate } from "@/components/auth-gate";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deriveMetrics, fetchOrganisationData } from "@/lib/analytics";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Northlight" },
      {
        name: "description",
        content:
          "Productivity and delivery reports: contributor output, completion trends and per-project throughput.",
      },
      { property: "og:title", content: "Reports — Northlight" },
      {
        property: "og:description",
        content: "Exportable-style breakdown of delivery productivity across the organisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsRoute,
});

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--color-popover-foreground)",
};

function ReportsRoute() {
  return (
    <AuthGate allow={ADMIN_ROLES} portal="admin">
      {(user) => (
        <AppShell
          userName={user.name}
          role={user.role}
          title="Reports"
          subtitle="Productivity and throughput analysis"
        >
          <ReportsContent />
        </AppShell>
      )}
    </AuthGate>
  );
}

function ReportsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["organisation-data"],
    queryFn: fetchOrganisationData,
  });

  if (isLoading || !data) return <Skeleton className="h-96 rounded-xl" />;
  const m = deriveMetrics(data);

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Daily update volume · last 14 days
        </h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={m.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="updates" name="Updates" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="tasksCompleted"
                name="Tasks completed"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Contributor output
        </h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.contributorPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="updates" name="Updates" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Tasks completed" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel overflow-x-auto p-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contributor</TableHead>
              <TableHead className="text-right">Updates</TableHead>
              <TableHead className="text-right">Tasks completed</TableHead>
              <TableHead className="text-right">Avg reported progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {m.contributorPerformance.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right tabular-nums">{c.updates}</TableCell>
                <TableCell className="text-right tabular-nums">{c.completed}</TableCell>
                <TableCell className="text-right tabular-nums">{c.avgProgress}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
