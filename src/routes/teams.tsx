import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ADMIN_ROLES, AuthGate } from "@/components/auth-gate";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteTeam, saveTeam, setPersonTeam, type Actor } from "@/lib/mutations";
import { fetchWorkspace, type Person, type Team } from "@/lib/workspace";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Teams — Northlight" },
      {
        name: "description",
        content:
          "Create teams, appoint team leaders and assign employees to teams across the organisation.",
      },
      { property: "og:title", content: "Teams — Northlight" },
      {
        property: "og:description",
        content: "Admin team builder: generate teams, set leaders and move members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate allow={ADMIN_ROLES} portal="admin">
      {(user) => (
        <AppShell
          userName={user.name}
          role={user.role}
          title="Teams"
          subtitle="Generate teams, appoint leaders and assign members"
          actions={<TeamDialog actor={user} trigger={<Button><Plus className="size-4" /> New team</Button>} />}
        >
          <TeamsBody actor={user} />
        </AppShell>
      )}
    </AuthGate>
  ),
});

const NONE = "__none__";

function TeamDialog({
  actor,
  team,
  trigger,
}: {
  actor: Actor;
  team?: Team;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["workspace"], queryFn: fetchWorkspace });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [leaderId, setLeaderId] = useState(team?.leader_id ?? NONE);
  const [busy, setBusy] = useState(false);

  const leaders = (data?.people ?? []).filter(
    (p) => p.role === "team_leader" || p.role === "admin" || p.role === "super_admin",
  );

  async function submit() {
    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }
    setBusy(true);
    try {
      await saveTeam(actor, {
        ...(team ? { id: team.id } : {}),
        name: name.trim(),
        description: description.trim() || null,
        leader_id: leaderId === NONE ? null : leaderId,
      });
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      toast.success(team ? "Team updated" : "Team created");
      setOpen(false);
      if (!team) {
        setName("");
        setDescription("");
        setLeaderId(NONE);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "Edit team" : "Generate a new team"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team Aurora"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-desc">Description</Label>
            <Textarea
              id="team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this team owns"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Team leader</Label>
            <Select value={leaderId} onValueChange={setLeaderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select leader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No leader yet</SelectItem>
                {leaders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={submit}>
            {team ? "Save changes" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamsBody({ actor }: { actor: Actor }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["workspace"], queryFn: fetchWorkspace });

  const people = useMemo(() => data?.people ?? [], [data]);
  const teams = data?.teams ?? [];
  const unassigned = people.filter((p) => !p.team_id && p.role === "member");

  async function move(person: Person, teamId: string | null) {
    try {
      await setPersonTeam(actor, person.id, person.full_name, teamId);
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      toast.success(`${person.full_name} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update member");
    }
  }

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No teams yet — use “New team” to generate your first one.
          </p>
        )}
        {teams.map((team) => {
          const leader = people.find((p) => p.id === team.leader_id);
          const members = people.filter((p) => p.team_id === team.id);
          return (
            <div key={team.id} className="panel space-y-3 p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <p className="truncate font-medium">{team.name}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {members.length} members
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leader: {leader?.full_name ?? "Unassigned"}
                  </p>
                  {team.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{team.description}</p>
                  )}
                </div>
                <TeamDialog
                  actor={actor}
                  team={team}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Edit team">
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <ConfirmDelete
                  title={`Delete ${team.name}?`}
                  description="Members will be left without a team."
                  onConfirm={async () => {
                    await deleteTeam(actor, team.id, team.name);
                    await qc.invalidateQueries({ queryKey: ["workspace"] });
                    toast.success("Team deleted");
                  }}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Delete team">
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  }
                />
              </div>

              <div className="space-y-2">
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground">No members assigned yet.</p>
                )}
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <span className="truncate text-sm">{m.full_name}</span>
                    <Button variant="ghost" size="sm" onClick={() => move(m, null)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel p-4">
        <p className="mb-3 font-medium">Unassigned employees</p>
        {unassigned.length === 0 ? (
          <p className="text-xs text-muted-foreground">Everyone is on a team.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {unassigned.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="truncate text-sm">{p.full_name}</span>
                <Select onValueChange={(v) => move(p, v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Add to team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
