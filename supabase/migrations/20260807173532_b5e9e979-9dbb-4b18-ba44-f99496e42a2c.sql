-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams readable" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams managed by admins" ON public.teams FOR ALL TO authenticated
  USING (public.has_role('super_admin') OR public.has_role('admin'))
  WITH CHECK (public.has_role('super_admin') OR public.has_role('admin'));
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Tasks extensions
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS team_leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachments text[] NOT NULL DEFAULT '{}'::text[];

-- Task comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments insert own" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = public.current_profile_id());
CREATE POLICY "comments delete own" ON public.task_comments FOR DELETE TO authenticated
  USING (author_id = public.current_profile_id() OR public.has_role('super_admin'));

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  entity_type text,
  entity_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own read" ON public.notifications FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id());
CREATE POLICY "notifications insert by authenticated" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (true);
CREATE POLICY "notifications own delete" ON public.notifications FOR DELETE TO authenticated
  USING (profile_id = public.current_profile_id());

-- Task policies: allow team leaders + task requests
DROP POLICY IF EXISTS "tasks insert by assigned" ON public.tasks;
CREATE POLICY "tasks insert by assigned" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('super_admin') OR public.has_role('admin') OR public.has_role('team_leader')
    OR created_by = public.current_profile_id()
    OR EXISTS (SELECT 1 FROM public.project_admins pa WHERE pa.project_id = tasks.project_id AND pa.profile_id = public.current_profile_id())
  );
DROP POLICY IF EXISTS "tasks update by assigned" ON public.tasks;
CREATE POLICY "tasks update by assigned" ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.has_role('super_admin') OR public.has_role('admin') OR public.has_role('team_leader')
    OR assigned_admin_id = public.current_profile_id()
    OR assigned_member_id = public.current_profile_id()
    OR team_leader_id = public.current_profile_id()
    OR created_by = public.current_profile_id()
    OR EXISTS (SELECT 1 FROM public.project_admins pa WHERE pa.project_id = tasks.project_id AND pa.profile_id = public.current_profile_id())
  ) WITH CHECK (true);
DROP POLICY IF EXISTS "tasks delete by super admin" ON public.tasks;
CREATE POLICY "tasks delete by admins" ON public.tasks FOR DELETE TO authenticated
  USING (public.has_role('super_admin') OR public.has_role('admin'));

-- Projects manageable by admins too
DROP POLICY IF EXISTS "projects managed by super admin" ON public.projects;
CREATE POLICY "projects managed by admins" ON public.projects FOR ALL TO authenticated
  USING (public.has_role('super_admin') OR public.has_role('admin'))
  WITH CHECK (public.has_role('super_admin') OR public.has_role('admin'));

-- Profiles manageable by admins
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role('super_admin') OR public.has_role('admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role('super_admin') OR public.has_role('admin'));
DROP POLICY IF EXISTS "super admin delete profiles" ON public.profiles;
CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role('super_admin') OR public.has_role('admin'));
DROP POLICY IF EXISTS "super admin insert profiles" ON public.profiles;
CREATE POLICY "admins insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role('super_admin') OR public.has_role('admin') OR user_id = auth.uid());

-- Roles manageable by admins
CREATE POLICY "roles insert by admins" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role('super_admin') OR public.has_role('admin'));
CREATE POLICY "roles delete by admins" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role('super_admin') OR public.has_role('admin'));
GRANT INSERT, DELETE ON public.user_roles TO authenticated;

-- Project members/admins manageable by admins (already ALL for super_admin)
DROP POLICY IF EXISTS "project members managed by super admin" ON public.project_members;
CREATE POLICY "project members managed by admins" ON public.project_members FOR ALL TO authenticated
  USING (public.has_role('super_admin') OR public.has_role('admin'))
  WITH CHECK (public.has_role('super_admin') OR public.has_role('admin'));
DROP POLICY IF EXISTS "project admins managed by super admin" ON public.project_admins;
CREATE POLICY "project admins managed by admins" ON public.project_admins FOR ALL TO authenticated
  USING (public.has_role('super_admin') OR public.has_role('admin'))
  WITH CHECK (public.has_role('super_admin') OR public.has_role('admin'));
