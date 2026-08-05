
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','member');
CREATE TYPE public.project_status AS ENUM ('not_started','planning','in_progress','under_review','completed','on_hold','cancelled');
CREATE TYPE public.task_status AS ENUM ('pending','started','in_progress','under_review','completed','rejected','blocked');
CREATE TYPE public.priority_level AS ENUM ('low','medium','high','critical');
CREATE TYPE public.presence_status AS ENUM ('online','idle','offline');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  avatar_url text,
  job_title text,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE p.user_id = auth.uid() AND ur.role = _role
  );
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role('super_admin')) WITH CHECK (user_id = auth.uid() OR public.has_role('super_admin'));
CREATE POLICY "super admin insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role('super_admin') OR user_id = auth.uid());
CREATE POLICY "super admin delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role('super_admin'));
CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROJECTS
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  client_name text,
  category text,
  priority public.priority_level NOT NULL DEFAULT 'medium',
  status public.project_status NOT NULL DEFAULT 'not_started',
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date date,
  end_date date,
  deadline date,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects readable" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects managed by super admin" ON public.projects FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.project_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_name text,
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_admins TO authenticated;
GRANT ALL ON public.project_admins TO service_role;
ALTER TABLE public.project_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project admins readable" ON public.project_admins FOR SELECT TO authenticated USING (true);
CREATE POLICY "project admins managed by super admin" ON public.project_admins FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project members readable" ON public.project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "project members managed by super admin" ON public.project_members FOR ALL TO authenticated USING (public.has_role('super_admin')) WITH CHECK (public.has_role('super_admin'));

-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority public.priority_level NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date date,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks readable" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks insert by assigned" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  public.has_role('super_admin') OR EXISTS (SELECT 1 FROM public.project_admins pa WHERE pa.project_id = tasks.project_id AND pa.profile_id = public.current_profile_id())
);
CREATE POLICY "tasks update by assigned" ON public.tasks FOR UPDATE TO authenticated USING (
  public.has_role('super_admin')
  OR assigned_admin_id = public.current_profile_id()
  OR assigned_member_id = public.current_profile_id()
  OR EXISTS (SELECT 1 FROM public.project_admins pa WHERE pa.project_id = tasks.project_id AND pa.profile_id = public.current_profile_id())
) WITH CHECK (true);
CREATE POLICY "tasks delete by super admin" ON public.tasks FOR DELETE TO authenticated USING (public.has_role('super_admin'));
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROGRESS UPDATES
CREATE TABLE public.progress_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_title text NOT NULL,
  work_description text,
  module_name text,
  progress_from integer NOT NULL DEFAULT 0,
  progress_to integer NOT NULL DEFAULT 0 CHECK (progress_to BETWEEN 0 AND 100),
  status public.task_status NOT NULL DEFAULT 'in_progress',
  github_url text,
  live_url text,
  screenshots text[] NOT NULL DEFAULT '{}',
  attachments text[] NOT NULL DEFAULT '{}',
  demo_video_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_updates TO authenticated;
GRANT ALL ON public.progress_updates TO service_role;
ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "updates readable" ON public.progress_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "updates insert own" ON public.progress_updates FOR INSERT TO authenticated WITH CHECK (author_id = public.current_profile_id());
CREATE POLICY "updates edit own" ON public.progress_updates FOR UPDATE TO authenticated USING (author_id = public.current_profile_id() OR public.has_role('super_admin')) WITH CHECK (true);
CREATE POLICY "updates delete" ON public.progress_updates FOR DELETE TO authenticated USING (author_id = public.current_profile_id() OR public.has_role('super_admin'));

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs readable" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs insert own" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (actor_id = public.current_profile_id());

-- ATTENDANCE
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  login_at timestamptz,
  logout_at timestamptz,
  working_hours numeric NOT NULL DEFAULT 0,
  presence public.presence_status NOT NULL DEFAULT 'offline',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.attendance_sessions TO authenticated;
GRANT ALL ON public.attendance_sessions TO service_role;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance readable" ON public.attendance_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance own write" ON public.attendance_sessions FOR INSERT TO authenticated WITH CHECK (profile_id = public.current_profile_id());
CREATE POLICY "attendance own update" ON public.attendance_sessions FOR UPDATE TO authenticated USING (profile_id = public.current_profile_id()) WITH CHECK (true);

-- SEED DATA
INSERT INTO public.profiles (id, email, full_name, job_title, department, is_active, last_seen_at) VALUES
 ('11111111-1111-1111-1111-111111111101','maya.rao@northlight.io','Maya Rao','Head of Delivery','Leadership',true, now() - interval '5 minutes'),
 ('11111111-1111-1111-1111-111111111102','dev.arora@northlight.io','Dev Arora','Frontend Lead','Engineering',true, now() - interval '20 minutes'),
 ('11111111-1111-1111-1111-111111111103','lena.fischer@northlight.io','Lena Fischer','Backend Lead','Engineering',true, now() - interval '2 hours'),
 ('11111111-1111-1111-1111-111111111104','samir.khan@northlight.io','Samir Khan','QA Lead','Quality',true, now() - interval '45 minutes'),
 ('11111111-1111-1111-1111-111111111105','ana.silva@northlight.io','Ana Silva','Product Designer','Design',true, now() - interval '10 minutes'),
 ('11111111-1111-1111-1111-111111111106','tom.becker@northlight.io','Tom Becker','React Developer','Engineering',true, now() - interval '3 hours'),
 ('11111111-1111-1111-1111-111111111107','priya.nair@northlight.io','Priya Nair','QA Engineer','Quality',true, now() - interval '1 hour'),
 ('11111111-1111-1111-1111-111111111108','jonas.weber@northlight.io','Jonas Weber','DevOps Engineer','Platform',true, now() - interval '8 hours'),
 ('11111111-1111-1111-1111-111111111109','iris.chen@northlight.io','Iris Chen','Data Analyst','Analytics',false, now() - interval '3 days');

INSERT INTO public.user_roles (profile_id, role) VALUES
 ('11111111-1111-1111-1111-111111111101','super_admin'),
 ('11111111-1111-1111-1111-111111111102','admin'),
 ('11111111-1111-1111-1111-111111111103','admin'),
 ('11111111-1111-1111-1111-111111111104','admin'),
 ('11111111-1111-1111-1111-111111111105','admin'),
 ('11111111-1111-1111-1111-111111111106','member'),
 ('11111111-1111-1111-1111-111111111107','member'),
 ('11111111-1111-1111-1111-111111111108','member'),
 ('11111111-1111-1111-1111-111111111109','member');

INSERT INTO public.projects (id,name,description,client_name,category,priority,status,progress,start_date,end_date,deadline) VALUES
 ('22222222-2222-2222-2222-222222222201','Atlas Banking Portal','Customer-facing retail banking dashboard rebuild.','Meridian Bank','Web App','critical','in_progress',68,CURRENT_DATE - 60,CURRENT_DATE + 30,CURRENT_DATE + 25),
 ('22222222-2222-2222-2222-222222222202','Helio CRM Migration','Migrate legacy CRM to a modern multi-tenant stack.','Helio Group','Platform','high','in_progress',44,CURRENT_DATE - 40,CURRENT_DATE + 50,CURRENT_DATE + 45),
 ('22222222-2222-2222-2222-222222222203','Verve Mobile Checkout','Native checkout flow with wallet support.','Verve Retail','Mobile','high','under_review',82,CURRENT_DATE - 90,CURRENT_DATE + 5,CURRENT_DATE - 2),
 ('22222222-2222-2222-2222-222222222204','Nimbus Analytics Suite','Self-service analytics and reporting workspace.','Nimbus Labs','Data','medium','planning',12,CURRENT_DATE - 10,CURRENT_DATE + 120,CURRENT_DATE + 110),
 ('22222222-2222-2222-2222-222222222205','Orbit HR Onboarding','Employee onboarding automation portal.','Orbit Corp','Internal','medium','completed',100,CURRENT_DATE - 200,CURRENT_DATE - 20,CURRENT_DATE - 25),
 ('22222222-2222-2222-2222-222222222206','Pulse IoT Console','Device fleet monitoring console.','Pulse Systems','IoT','low','on_hold',35,CURRENT_DATE - 120,CURRENT_DATE + 60,CURRENT_DATE + 15);

INSERT INTO public.project_admins (project_id,profile_id,module_name,weight) VALUES
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111102','Frontend',2),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111103','Backend',2),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111104','Testing',1),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111103','Backend',2),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111105','Design',1),
 ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111102','Frontend',2),
 ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111104','Testing',1),
 ('22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111105','Discovery',1),
 ('22222222-2222-2222-2222-222222222205','11111111-1111-1111-1111-111111111103','Delivery',1),
 ('22222222-2222-2222-2222-222222222206','11111111-1111-1111-1111-111111111102','Frontend',1);

INSERT INTO public.project_members (project_id,profile_id,module_name) VALUES
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111106','Frontend'),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111107','Testing'),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111108','Platform'),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111106','Frontend'),
 ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111107','Testing'),
 ('22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111109','Analytics'),
 ('22222222-2222-2222-2222-222222222205','11111111-1111-1111-1111-111111111108','Platform'),
 ('22222222-2222-2222-2222-222222222206','11111111-1111-1111-1111-111111111106','Frontend');

INSERT INTO public.tasks (project_id,title,description,assigned_admin_id,assigned_member_id,priority,status,progress,start_date,due_date,completed_at,created_at)
SELECT p.project_id::uuid, t.title, t.description, t.admin_id, t.member_id, t.priority, t.status, t.progress,
       CURRENT_DATE - t.offset_days, CURRENT_DATE + t.due_in, t.completed_at, now() - (t.offset_days || ' days')::interval
FROM (VALUES ('22222222-2222-2222-2222-222222222201')) AS p(project_id),
LATERAL (VALUES
 ('Account overview redesign','Rebuild the balance and transactions view.','11111111-1111-1111-1111-111111111102'::uuid,'11111111-1111-1111-1111-111111111106'::uuid,'high'::public.priority_level,'completed'::public.task_status,100,30,-5,now() - interval '5 days'),
 ('Transfers API v2','New payments API with idempotency.','11111111-1111-1111-1111-111111111103'::uuid,NULL::uuid,'critical'::public.priority_level,'in_progress'::public.task_status,70,25,10,NULL::timestamptz),
 ('Regression suite','End-to-end coverage for the transfer journey.','11111111-1111-1111-1111-111111111104'::uuid,'11111111-1111-1111-1111-111111111107'::uuid,'medium'::public.priority_level,'in_progress'::public.task_status,45,15,12,NULL::timestamptz),
 ('Accessibility audit','WCAG AA pass across the portal.','11111111-1111-1111-1111-111111111102'::uuid,'11111111-1111-1111-1111-111111111106'::uuid,'medium'::public.priority_level,'pending'::public.task_status,0,3,20,NULL::timestamptz)
) AS t(title,description,admin_id,member_id,priority,status,progress,offset_days,due_in,completed_at);

INSERT INTO public.tasks (project_id,title,description,assigned_admin_id,assigned_member_id,priority,status,progress,start_date,due_date,completed_at) VALUES
 ('22222222-2222-2222-2222-222222222202','Tenant data model','Design multi-tenant schema.','11111111-1111-1111-1111-111111111103','11111111-1111-1111-1111-111111111108','critical','in_progress',60,CURRENT_DATE-20,CURRENT_DATE+14,NULL),
 ('22222222-2222-2222-2222-222222222202','Design system tokens','Shared tokens for the CRM shell.','11111111-1111-1111-1111-111111111105','11111111-1111-1111-1111-111111111106','medium','under_review',85,CURRENT_DATE-18,CURRENT_DATE+3,NULL),
 ('22222222-2222-2222-2222-222222222202','Legacy data import','ETL from the old CRM.','11111111-1111-1111-1111-111111111103','11111111-1111-1111-1111-111111111108','high','blocked',25,CURRENT_DATE-12,CURRENT_DATE+21,NULL),
 ('22222222-2222-2222-2222-222222222203','Wallet integration','Apple Pay and Google Pay.','11111111-1111-1111-1111-111111111102','11111111-1111-1111-1111-111111111106','critical','completed',100,CURRENT_DATE-60,CURRENT_DATE-8,now()-interval '8 days'),
 ('22222222-2222-2222-2222-222222222203','Checkout QA sign-off','Final release validation.','11111111-1111-1111-1111-111111111104','11111111-1111-1111-1111-111111111107','high','under_review',90,CURRENT_DATE-14,CURRENT_DATE+2,NULL),
 ('22222222-2222-2222-2222-222222222204','Discovery workshops','Stakeholder interviews and scoping.','11111111-1111-1111-1111-111111111105','11111111-1111-1111-1111-111111111109','medium','started',20,CURRENT_DATE-8,CURRENT_DATE+18,NULL),
 ('22222222-2222-2222-2222-222222222205','Handover documentation','Runbooks and support handover.','11111111-1111-1111-1111-111111111103','11111111-1111-1111-1111-111111111108','low','completed',100,CURRENT_DATE-40,CURRENT_DATE-22,now()-interval '22 days'),
 ('22222222-2222-2222-2222-222222222206','Device telemetry chart','Realtime charts for device health.','11111111-1111-1111-1111-111111111102','11111111-1111-1111-1111-111111111106','low','pending',10,CURRENT_DATE-30,CURRENT_DATE+40,NULL);

INSERT INTO public.progress_updates (project_id,author_id,work_title,work_description,module_name,progress_from,progress_to,status,github_url,live_url,screenshots,notes,created_at)
SELECT v.project_id::uuid, v.author_id::uuid, v.work_title, v.work_description, v.module_name, v.pfrom, v.pto, v.status::public.task_status, v.gh, v.live, v.shots, v.notes, now() - (v.days_ago || ' days')::interval - (v.hours_ago || ' hours')::interval
FROM (VALUES
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111102','Transactions table virtualisation','Rendered 10k rows smoothly with windowing.','Frontend',60,70,'in_progress','https://github.com/northlight/atlas-portal','https://atlas-portal.demo.app',ARRAY['https://images.unsplash.com/photo-1551288049-bebda4e38f71'],'Perf budget met.',0,3),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111103','Transfers API idempotency','Added idempotency keys and retry semantics.','Backend',40,55,'in_progress','https://github.com/northlight/atlas-api',NULL,ARRAY[]::text[],NULL,0,6),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111107','Regression pass','Executed 120 scenarios, 6 defects raised.','Testing',20,35,'in_progress',NULL,NULL,ARRAY['https://images.unsplash.com/photo-1460925895917-afdab827c52f','https://images.unsplash.com/photo-1504384308090-c894fdcc538d'],'Six defects logged.',1,2),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111103','Tenant isolation spike','Row level isolation proven on staging.','Backend',30,45,'under_review','https://github.com/northlight/helio-core',NULL,ARRAY[]::text[],NULL,1,5),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111105','CRM shell tokens','Colour and spacing tokens published.','Design',55,80,'under_review',NULL,'https://helio-design.demo.app',ARRAY['https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7'],NULL,2,1),
 ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111102','Wallet flow polish','Sheet animation and error states finished.','Frontend',75,90,'completed','https://github.com/northlight/verve-checkout','https://verve-checkout.demo.app',ARRAY['https://images.unsplash.com/photo-1556742049-0cfed4f6a45d'],'Ready for release review.',2,4),
 ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111104','Release candidate testing','RC2 validated on 8 devices.','Testing',70,85,'under_review',NULL,NULL,ARRAY['https://images.unsplash.com/photo-1517430816045-df4b7de11d1d','https://images.unsplash.com/photo-1522199755839-a2bacb67c546'],NULL,3,2),
 ('22222222-2222-2222-2222-222222222204','11111111-1111-1111-1111-111111111105','Discovery synthesis','Interview findings clustered into themes.','Discovery',5,12,'started',NULL,NULL,ARRAY[]::text[],'Workshop 2 scheduled.',4,3),
 ('22222222-2222-2222-2222-222222222205','11111111-1111-1111-1111-111111111103','Final handover','Runbooks signed off by client.','Delivery',95,100,'completed','https://github.com/northlight/orbit-hr','https://orbit-hr.demo.app',ARRAY['https://images.unsplash.com/photo-1454165804606-c3d57bc86b40'],NULL,20,1),
 ('22222222-2222-2222-2222-222222222206','11111111-1111-1111-1111-111111111102','Paused pending hardware','Work paused until firmware v3 ships.','Frontend',35,35,'blocked',NULL,NULL,ARRAY[]::text[],'Blocked by client.',6,2),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111106','Component library cleanup','Removed 14 duplicate components.','Frontend',55,60,'completed','https://github.com/northlight/atlas-portal',NULL,ARRAY['https://images.unsplash.com/photo-1467232004584-a241de8bcf5d'],NULL,5,1),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111108','Pipeline hardening','CI now runs migrations against a clone.','Platform',20,35,'in_progress','https://github.com/northlight/helio-infra',NULL,ARRAY[]::text[],NULL,7,4),
 ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111104','Security review','Threat model reviewed with the client.','Testing',35,40,'under_review',NULL,NULL,ARRAY[]::text[],NULL,9,2),
 ('22222222-2222-2222-2222-222222222203','11111111-1111-1111-1111-111111111107','Device matrix expansion','Added 3 low-end Android devices.','Testing',60,70,'in_progress',NULL,NULL,ARRAY['https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c'],NULL,12,5),
 ('22222222-2222-2222-2222-222222222202','11111111-1111-1111-1111-111111111106','CRM list view','Virtualised contact list shipped.','Frontend',30,40,'completed','https://github.com/northlight/helio-web','https://helio-crm.demo.app',ARRAY['https://images.unsplash.com/photo-1531403009284-440f080d1e12'],NULL,15,3)
) AS v(project_id,author_id,work_title,work_description,module_name,pfrom,pto,status,gh,live,shots,notes,days_ago,hours_ago);

INSERT INTO public.activity_logs (actor_id,project_id,action,entity_type,created_at)
SELECT author_id, project_id, 'progress_update', 'progress_updates', created_at FROM public.progress_updates;

INSERT INTO public.attendance_sessions (profile_id,session_date,login_at,logout_at,working_hours,presence)
SELECT p.id, CURRENT_DATE - d,
  (CURRENT_DATE - d) + time '09:00' + (random() * interval '45 minutes'),
  (CURRENT_DATE - d) + time '18:00' + (random() * interval '90 minutes'),
  round((7 + random() * 3)::numeric, 2),
  (ARRAY['online','idle','offline']::public.presence_status[])[1 + floor(random()*3)::int]
FROM public.profiles p CROSS JOIN generate_series(0, 20) AS d
WHERE p.is_active;
