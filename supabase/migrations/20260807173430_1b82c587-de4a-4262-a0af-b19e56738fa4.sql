-- 1. Role + status enum extensions
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_leader';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'overdue';
