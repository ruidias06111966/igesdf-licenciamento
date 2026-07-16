
-- Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke public execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Drop permissive policies and replace with admin-scoped ones
DROP POLICY IF EXISTS "auth read log" ON public.atividade_log;
DROP POLICY IF EXISTS "auth insert log" ON public.atividade_log;
CREATE POLICY "admin read log" ON public.atividade_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "auth insert own log" ON public.atividade_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "auth read doc" ON public.documentos;
DROP POLICY IF EXISTS "auth write doc" ON public.documentos;
CREATE POLICY "admin read doc" ON public.documentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write doc" ON public.documentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth read licencas" ON public.licencas;
DROP POLICY IF EXISTS "auth write licencas" ON public.licencas;
CREATE POLICY "admin read licencas" ON public.licencas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write licencas" ON public.licencas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth read notif" ON public.notificacoes_vencimento;
CREATE POLICY "admin read notif" ON public.notificacoes_vencimento FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth read rt" ON public.responsaveis_tecnicos;
DROP POLICY IF EXISTS "auth write rt" ON public.responsaveis_tecnicos;
CREATE POLICY "admin read rt" ON public.responsaveis_tecnicos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write rt" ON public.responsaveis_tecnicos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth write unidades" ON public.unidades;
CREATE POLICY "admin write unidades" ON public.unidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- keep read for authenticated (existing "auth read unidades")

-- Storage: restrict licencas-docs bucket to admins
DROP POLICY IF EXISTS "auth read docs" ON storage.objects;
DROP POLICY IF EXISTS "auth upload docs" ON storage.objects;
DROP POLICY IF EXISTS "auth update docs" ON storage.objects;
DROP POLICY IF EXISTS "auth delete docs" ON storage.objects;

CREATE POLICY "admin read docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'licencas-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin upload docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'licencas-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'licencas-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'licencas-docs' AND public.has_role(auth.uid(), 'admin'));
