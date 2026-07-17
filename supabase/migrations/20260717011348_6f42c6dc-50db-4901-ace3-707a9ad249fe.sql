
-- 1. Remove auto-admin-on-first-signup behaviour
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- New signups receive no role by default. An existing admin must
  -- promote them explicitly by inserting into public.user_roles.
  RETURN NEW;
END;
$$;

-- 2. Reduce SECURITY DEFINER function exposure to signed-in users.
-- Trigger functions never need to be callable directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role is invoked inside RLS policies, so authenticated must retain EXECUTE;
-- lock it down from anon and public.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 3. Restrict unidades reads to admins (same rule as writes).
DROP POLICY IF EXISTS "auth read unidades" ON public.unidades;
CREATE POLICY "admin read unidades"
ON public.unidades
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
