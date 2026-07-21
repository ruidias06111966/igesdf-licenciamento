
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('atividade_log','checklist_itens','checklist_templates','cnaes_unidade','documentos','licencas','notificacoes_vencimento','orgaos','responsaveis_tecnicos','unidades')
      AND policyname LIKE 'admin%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "authenticated read orgaos" ON public.orgaos;
DROP POLICY IF EXISTS "auth insert own log" ON public.atividade_log;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['checklist_itens','checklist_templates','cnaes_unidade','documentos','licencas','notificacoes_vencimento','orgaos','responsaveis_tecnicos','unidades']
  LOOP
    EXECUTE format('CREATE POLICY "auth full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

CREATE POLICY "auth read log" ON public.atividade_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own log" ON public.atividade_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
