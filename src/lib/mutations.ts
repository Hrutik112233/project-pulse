import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Priority, Task, TaskStatus } from "@/lib/workspace";

export type Actor = { profileId: string; name: string; role: AppRole };

export async function logActivity(input: {
  actorId: string;
  action: string;
  entityType?: string;
  entityId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await supabase.from("activity_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    project_id: input.projectId ?? null,
    metadata: (input.metadata ?? {}) as never,
  });
}

export async function notify(
  profileIds: (string | null | undefined)[],
  message: string,
  type = "info",
  entity?: { type: string; id: string },
) {
  const targets = [...new Set(profileIds.filter(Boolean) as string[])];
  if (!targets.length) return;
  await supabase.from("notifications").insert(
    targets.map((profile_id) => ({
      profile_id,
      message,
      type,
      entity_type: entity?.type ?? null,
      entity_id: entity?.id ?? null,
    })),
  );
}

/** Recomputes a project's progress + status from its tasks. */
export async function recalcProject(projectId: string) {
  const { data } = await supabase.from("tasks").select("status").eq("project_id", projectId);
  const rows = data ?? [];
  if (!rows.length) return;
  const completed = rows.filter((t) => t.status === "completed").length;
  const progress = Math.round((completed / rows.length) * 100);
  await supabase
    .from("projects")
    .update({ progress, status: progress === 100 ? "completed" : "in_progress" })
    .eq("id", projectId);
}

export type TaskInput = {
  title: string;
  description?: string;
  project_id: string;
  assigned_member_id?: string | null;
  team_leader_id?: string | null;
  priority: Priority;
  status: TaskStatus;
  progress?: number;
  start_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  attachments?: string[];
};

export async function createTask(actor: Actor, input: TaskInput) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      description: input.description ?? null,
      progress: input.progress ?? 0,
      created_by: actor.profileId,
      attachments: input.attachments ?? [],
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const task = data as unknown as Task;

  const requested = input.status === "pending_approval";
  await logActivity({
    actorId: actor.profileId,
    action: requested ? `requested task "${task.title}"` : `created task "${task.title}"`,
    entityType: "task",
    entityId: task.id,
    projectId: task.project_id,
    metadata: { new_status: task.status, priority: task.priority },
  });

  if (requested) {
    await notify(
      [input.team_leader_id],
      `${actor.name} submitted a task request: ${task.title}`,
      "request",
      { type: "task", id: task.id },
    );
  } else {
    await notify([input.assigned_member_id], `New task assigned: ${task.title}`, "assignment", {
      type: "task",
      id: task.id,
    });
  }
  await recalcProject(task.project_id);
  return task;
}

export async function updateTask(
  actor: Actor,
  task: Task,
  patch: Partial<TaskInput> & { status?: TaskStatus; progress?: number },
) {
  const next: Record<string, unknown> = { ...patch };
  if (patch.status === "completed") {
    next["completed_at"] = new Date().toISOString();
    next["progress"] = 100;
  }
  const { error } = await supabase.from("tasks").update(next as never).eq("id", task.id);
  if (error) throw new Error(error.message);

  const statusChanged = patch.status && patch.status !== task.status;
  await logActivity({
    actorId: actor.profileId,
    action: statusChanged
      ? `changed task "${task.title}" to ${patch.status}`
      : `updated task "${task.title}"`,
    entityType: "task",
    entityId: task.id,
    projectId: task.project_id,
    metadata: {
      previous_status: task.status,
      new_status: patch.status ?? task.status,
      progress: patch.progress ?? task.progress,
    },
  });

  if (statusChanged) {
    const audience = [task.assigned_member_id, task.team_leader_id, task.created_by].filter(
      (id) => id !== actor.profileId,
    );
    await notify(audience, `Task "${task.title}" is now ${patch.status}`, "status", {
      type: "task",
      id: task.id,
    });
  }
  await recalcProject(task.project_id);
}

export async function approveTask(actor: Actor, task: Task, assignTo?: string | null) {
  await updateTask(actor, task, {
    status: "assigned",
    assigned_member_id: assignTo ?? task.assigned_member_id ?? task.created_by,
  });
  await notify([task.created_by], `Your task request "${task.title}" was approved`, "approval", {
    type: "task",
    id: task.id,
  });
}

export async function rejectTask(actor: Actor, task: Task) {
  await updateTask(actor, task, { status: "rejected" });
  await notify([task.created_by], `Your task request "${task.title}" was rejected`, "approval", {
    type: "task",
    id: task.id,
  });
}

export async function deleteTask(actor: Actor, task: Task) {
  const { error } = await supabase.from("tasks").delete().eq("id", task.id);
  if (error) throw new Error(error.message);
  await logActivity({
    actorId: actor.profileId,
    action: `deleted task "${task.title}"`,
    entityType: "deleted",
    entityId: task.id,
    projectId: task.project_id,
    metadata: { previous_status: task.status },
  });
  await recalcProject(task.project_id);
}

export async function addComment(actor: Actor, taskId: string, body: string) {
  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, author_id: actor.profileId, body });
  if (error) throw new Error(error.message);
  await logActivity({
    actorId: actor.profileId,
    action: "commented on a task",
    entityType: "task",
    entityId: taskId,
  });
}

/* ---------- Projects ---------- */

export async function saveProject(
  actor: Actor,
  input: {
    id?: string;
    name: string;
    description?: string | null;
    client_name?: string | null;
    priority: Priority;
    start_date?: string | null;
    deadline?: string | null;
  },
) {
  if (input.id) {
    const { error } = await supabase.from("projects").update(input as never).eq("id", input.id);
    if (error) throw new Error(error.message);
    await logActivity({
      actorId: actor.profileId,
      action: `updated project "${input.name}"`,
      entityType: "project",
      entityId: input.id,
      projectId: input.id,
    });
    return input.id;
  }
  const { data, error } = await supabase
    .from("projects")
    .insert(input as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logActivity({
    actorId: actor.profileId,
    action: `created project "${input.name}"`,
    entityType: "project",
    entityId: data.id,
    projectId: data.id,
  });
  return data.id;
}

export async function deleteProject(actor: Actor, id: string, name: string) {
  await supabase.from("tasks").delete().eq("project_id", id);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({
    actorId: actor.profileId,
    action: `deleted project "${name}"`,
    entityType: "deleted",
    entityId: id,
  });
}

/* ---------- People ---------- */

export async function savePerson(
  actor: Actor,
  input: {
    id?: string;
    full_name: string;
    email: string;
    job_title?: string | null;
    department?: string | null;
    team_id?: string | null;
    is_active?: boolean;
  },
  role: AppRole,
) {
  let profileId = input.id;
  if (profileId) {
    const { error } = await supabase.from("profiles").update(input as never).eq("id", profileId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .insert(input as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    profileId = data.id;
  }

  await supabase.from("user_roles").delete().eq("profile_id", profileId);
  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ profile_id: profileId, role });
  if (roleError) throw new Error(roleError.message);

  await logActivity({
    actorId: actor.profileId,
    action: `${input.id ? "updated" : "added"} user "${input.full_name}" (${role})`,
    entityType: "user",
    entityId: profileId,
  });
  return profileId;
}

export async function deletePerson(actor: Actor, id: string, name: string) {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({
    actorId: actor.profileId,
    action: `deleted user "${name}"`,
    entityType: "deleted",
    entityId: id,
  });
}

export async function setPersonActive(actor: Actor, id: string, name: string, active: boolean) {
  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({
    actorId: actor.profileId,
    action: `${active ? "activated" : "deactivated"} user "${name}"`,
    entityType: "user",
    entityId: id,
  });
}

/* ---------- Teams ---------- */

export async function saveTeam(
  actor: Actor,
  input: { id?: string; name: string; description?: string | null; leader_id?: string | null },
) {
  if (input.id) {
    const { error } = await supabase.from("teams").update(input as never).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("teams").insert(input as never);
    if (error) throw new Error(error.message);
  }
  await logActivity({
    actorId: actor.profileId,
    action: `${input.id ? "updated" : "created"} team "${input.name}"`,
    entityType: "team",
    entityId: input.id ?? null,
  });
}

export async function deleteTeam(actor: Actor, id: string, name: string) {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({
    actorId: actor.profileId,
    action: `deleted team "${name}"`,
    entityType: "deleted",
    entityId: id,
  });
}
