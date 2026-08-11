import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ADMIN_ROLES, AuthGate } from "@/components/auth-gate";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deletePerson, savePerson, setPersonActive, type Actor } from "@/lib/mutations";
import { downloadCsv } from "@/lib/reports";
import { fetchWorkspace, formatDate, type AppRole, type Person } from "@/lib/workspace";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User management — Northlight" },
      {
        name: "description",
        content:
          "Add employees, assign admin, team leader or member roles, deactivate accounts and remove users.",
      },
      { property: "og:title", content: "User management — Northlight" },
      {
        property: "og:description",
        content: "Role-based user administration with safe delete confirmation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate allow={ADMIN_ROLES} portal="admin">
      {(user) => <UsersPage actor={user} />}
    </AuthGate>
  ),
});

const ALL = "__all__";
const NONE = "__none__";

const ROLES: AppRole[] = ["super_admin", "admin", "team_leader", "member"];
const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  team_leader: "Team Leader",
  member: "Team Member",
};

function UsersPage({ actor }: { actor: Actor }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["workspace"], queryFn: fetchWorkspace });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);

  const refresh = () => qc.invalidateQueries({ queryKey: ["workspace"] });
  const people = data?.people ?? [];
  const teams = data?.teams ?? [];

  const filtered = useMemo(
    () =>
      people.filter((p) => {
        const q = search.toLowerCase();
        if (q && !`${p.full_name} ${p.email}`.toLowerCase().includes(q)) return false;
        if (roleFilter !== ALL && p.role !== roleFilter) return false;
        return true;
      }),
    [people, search, roleFilter],
  );

  return (
    <AppShell
      userName={actor.name}
      role={actor.role}
      title="User management"
      subtitle="Roles, teams and account status"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "users",
                [
                  { header: "Name", value: (p: Person) => p.full_name },
                  { header: "Email", value: (p: Person) => p.email },
                  { header: "Role", value: (p: Person) => ROLE_LABEL[p.role] },
                  { header: "Department", value: (p: Person) => p.department ?? "—" },
                  { header: "Active", value: (p: Person) => (p.is_active ? "Yes" : "No") },
                  { header: "Joined", value: (p: Person) => formatDate(p.created_at) },
                ],
                filtered,
              )
            }
          >
            <Download className="size-4" /> CSV
          </Button>
          <UserDialog
            actor={actor}
            teams={teams}
            onSaved={refresh}
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> Add user
              </Button>
            }
          />
        </div>
      }
    >
      {isLoading || !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-4">
          <div className="panel flex flex-wrap items-center gap-2 p-3">
            <Input
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full sm:w-64"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="panel overflow-x-auto p-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <p className="font-medium">{person.full_name}</p>
                      <p className="text-xs text-muted-foreground">{person.job_title ?? "—"}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{person.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ROLE_LABEL[person.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {teams.find((t) => t.id === person.team_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          person.is_active
                            ? "border-emerald-500/40 text-emerald-400"
                            : "border-muted-foreground/40 text-muted-foreground"
                        }
                      >
                        {person.is_active ? "Active" : "Deactivated"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={person.is_active ? "Deactivate" : "Activate"}
                          onClick={async () => {
                            await setPersonActive(
                              actor,
                              person.id,
                              person.full_name,
                              !person.is_active,
                            );
                            await refresh();
                            toast.success(person.is_active ? "User deactivated" : "User activated");
                          }}
                        >
                          <Power
                            className={
                              person.is_active ? "size-4 text-emerald-500" : "size-4 text-muted-foreground"
                            }
                          />
                        </Button>
                        <UserDialog
                          actor={actor}
                          teams={teams}
                          person={person}
                          onSaved={refresh}
                          trigger={
                            <Button size="icon" variant="ghost" title="Edit">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <ConfirmDelete
                          title={`Delete ${person.full_name}?`}
                          description="The user loses access and is removed from the directory."
                          onConfirm={async () => {
                            await deletePerson(actor, person.id, person.full_name);
                            await refresh();
                            toast.success("User deleted");
                          }}
                          trigger={
                            <Button size="icon" variant="ghost" title="Delete">
                              <Trash2 className="size-4 text-red-500" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No users match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function UserDialog({
  actor,
  person,
  teams,
  trigger,
  onSaved,
}: {
  actor: Actor;
  person?: Person;
  teams: { id: string; name: string }[];
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState(person?.full_name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [jobTitle, setJobTitle] = useState(person?.job_title ?? "");
  const [department, setDepartment] = useState(person?.department ?? "");
  const [teamId, setTeamId] = useState(person?.team_id ?? NONE);
  const [role, setRole] = useState<AppRole>(person?.role ?? "member");

  async function submit() {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      await savePerson(
        actor,
        {
          ...(person ? { id: person.id } : {}),
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          job_title: jobTitle.trim() || null,
          department: department.trim() || null,
          team_id: teamId === NONE ? null : teamId,
        },
        role,
      );
      onSaved();
      toast.success(person ? "User updated" : "User added");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person ? "Edit user" : "Add user"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="u-name">Full name</Label>
            <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="u-email">Email</Label>
            <Input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The account links automatically when this person signs up with the same email.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="u-job">Job title</Label>
              <Input id="u-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-dept">Department</Label>
              <Input
                id="u-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No team</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {person ? "Save changes" : "Add user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
