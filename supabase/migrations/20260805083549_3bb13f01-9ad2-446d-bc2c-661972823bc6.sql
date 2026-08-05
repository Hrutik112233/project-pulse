REVOKE EXECUTE ON FUNCTION public.has_role(public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;