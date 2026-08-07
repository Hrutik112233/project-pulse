import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "team_leader" | "member";

export type TaskStatus =
  | "pending_approval"
  | "pending"
  | "assigned"
  | "started"
  | "in_progress"
  | "under_review"
  | "completed"
  | "rejected"
  | "blocked"
  | "overdue";

export type Priority = "low" | "medium" | "high" | "critical";

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_admin_id: string | null;
  assigned_member_id: string | null;
  team_leader_id: string | null;
  created_by: string | null;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  notes: string | null;
  attachments: string[];
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  category: string | null;
  priority: Priority;
  status: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
  is_archived: boolean;
  created_at: string;
};

export type Person = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  team_id: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  role: AppRole;
};

export type Team = {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
};

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  project_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Notification = {
  id: string;
  profile_id: string;
  message: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
};

export const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending approval",
  pending: "Pending",
  assigned: "Assigned",
  started: "Started",
  in_progress: "In progress",
  under_review: "Under review",
  completed: "Completed",
  rejected: "Rejected",
  blocked: "Blocked",
  overdue: "Overdue",
  not_started: "Not started",
  planning: "Planning",
  on_hold: "On hold",
  cancelled: "Cancelled",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const TASK_STATUSES: TaskStatus[] = [
  "pending_approval",
  "assigned",
  "in_progress",
  "under_review",
  "completed",
  "blocked",
  "rejected",
];

export function isOverdue(task: Pick<Task, "due_date" | "status">) {
  if (!task.due_date || task.status === "completed" || task.status === "rejected") return false;
  const due = new Date(task.due_date);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

/** Effective status: derives "overdue" from the due date without mutating the row. */
export function effectiveStatus(task: Task): TaskStatus {
  return isOverdue(task) ? "overdue" : task.status;
}

export function projectCompletion(tasks: Task[]) {
  if (!tasks.length) return 0;
  const done = tasks.filter((t) => t.status === "completed").length;
  return Math.round((done / tasks.length) * 100);
}

export function taskStats(tasks: Task[]) {
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const pendingApproval = tasks.filter((t) => t.status === "pending_approval").length;
  const pending = tasks.length - completed;
  return {
    total: tasks.length,
    completed,
    pending,
    overdue,
    pendingApproval,
    highPriority: tasks.filter((t) => t.priority === "high" || t.priority === "critical").length,
    completion: projectCompletion(tasks),
  };
}

export async function fetchWorkspace() {
  const [projects, tasks, profiles, roles, teams, logs] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("user_roles").select("profile_id,role"),
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rank: Record<string, number> = { super_admin: 4, admin: 3, team_leader: 2, member: 1 };
  const roleByProfile = new Map<string, AppRole>();
  for (const r of roles.data ?? []) {
    const current = roleByProfile.get(r.profile_id);
    if (!current || (rank[r.role] ?? 0) > (rank[current] ?? 0)) {
      roleByProfile.set(r.profile_id, r.role as AppRole);
    }
  }

  const people = ((profiles.data ?? []) as unknown as Person[]).map((p) => ({
    ...p,
    role: roleByProfile.get(p.id) ?? ("member" as AppRole),
  }));

  return {
    projects: (projects.data ?? []) as unknown as Project[],
    tasks: (tasks.data ?? []) as unknown as Task[],
    people,
    teams: (teams.data ?? []) as unknown as Team[],
    logs: (logs.data ?? []) as unknown as ActivityLog[],
  };
}

export type Workspace = Awaited<ReturnType<typeof fetchWorkspace>>;

export function nameOf(people: Person[], id: string | null | undefined) {
  if (!id) return "—";
  return people.find((p) => p.id === id)?.full_name ?? "Unknown";
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
