import { supabase } from "@/integrations/supabase/client";
import { logActivity, notify, updateTask, type Actor } from "@/lib/mutations";
import type { Task, TaskStatus } from "@/lib/workspace";

export const WORK_BUCKET = "work-screenshots";

/** Uploads screenshots to storage and returns their storage paths. */
export async function uploadScreenshots(profileId: string, files: File[]) {
  const paths: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${profileId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(WORK_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    paths.push(path);
  }
  return paths;
}

/** Resolves storage paths (or absolute URLs) into viewable URLs. */
export async function resolveScreenshotUrls(paths: string[]) {
  if (!paths.length) return [] as string[];
  const out: string[] = [];
  const toSign = paths.filter((p) => !/^https?:\/\//.test(p));
  let signed: Record<string, string> = {};
  if (toSign.length) {
    const { data } = await supabase.storage.from(WORK_BUCKET).createSignedUrls(toSign, 3600);
    signed = Object.fromEntries(
      (data ?? []).map((d) => [d.path ?? "", d.signedUrl ?? ""]).filter(([, u]) => u),
    );
  }
  for (const p of paths) {
    if (/^https?:\/\//.test(p)) out.push(p);
    else if (signed[p]) out.push(signed[p]);
  }
  return out;
}

export type WorkSubmission = {
  project_id: string;
  task_id?: string | null;
  work_title: string;
  work_description?: string | null;
  module_name?: string | null;
  progress_from: number;
  progress_to: number;
  status: TaskStatus;
  github_url?: string | null;
  live_url?: string | null;
  screenshots: string[];
  notes?: string | null;
};

/** Posts a progress update, syncs the linked task and notifies the team. */
export async function submitWork(actor: Actor, input: WorkSubmission, task?: Task | null) {
  const status = (["in_progress", "under_review", "completed", "blocked"] as const).includes(
    input.status as never,
  )
    ? input.status
    : "in_progress";

  const { error } = await supabase.from("progress_updates").insert({
    project_id: input.project_id,
    task_id: input.task_id ?? null,
    author_id: actor.profileId,
    work_title: input.work_title,
    work_description: input.work_description ?? null,
    module_name: input.module_name ?? null,
    progress_from: input.progress_from,
    progress_to: input.progress_to,
    status: status as never,
    github_url: input.github_url || null,
    live_url: input.live_url || null,
    screenshots: input.screenshots,
    notes: input.notes ?? null,
  } as never);
  if (error) throw new Error(error.message);

  if (task) {
    await updateTask(actor, task, {
      progress: input.progress_to,
      status: input.status,
    });
  }

  await logActivity({
    actorId: actor.profileId,
    action: `submitted work "${input.work_title}"`,
    entityType: "progress_update",
    entityId: input.task_id ?? null,
    projectId: input.project_id,
    metadata: {
      github_url: input.github_url ?? null,
      live_url: input.live_url ?? null,
      screenshots: input.screenshots.length,
      progress_to: input.progress_to,
    },
  });

  await notify(
    [task?.team_leader_id, task?.assigned_admin_id, task?.created_by].filter(
      (id) => id && id !== actor.profileId,
    ),
    `${actor.name} submitted work: ${input.work_title} (${input.progress_to}%)`,
    "update",
    { type: "project", id: input.project_id },
  );
}
