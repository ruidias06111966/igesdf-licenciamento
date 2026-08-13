-- O acesso à aplicação é feito apenas pelo servidor (service role) após a senha
-- partilhada. As funções anon/authenticated deixam de ter qualquer acesso.

DROP POLICY IF EXISTS "auth insert own log" ON public.atividade_log;
DROP POLICY IF EXISTS "auth read log" ON public.atividade_log;
DROP POLICY IF EXISTS "auth full access" ON public.checklist_itens;
DROP POLICY IF EXISTS "auth full access" ON public.checklist_templates;
DROP POLICY IF EXISTS "auth full access" ON public.cnaes_unidade;
DROP POLICY IF EXISTS "auth full access" ON public.documentos;
DROP POLICY IF EXISTS "auth full access" ON public.licencas;
DROP POLICY IF EXISTS "auth full access" ON public.normativas;
DROP POLICY IF EXISTS "auth full access" ON public.notificacoes_vencimento;
DROP POLICY IF EXISTS "auth full access" ON public.orgaos;
DROP POLICY IF EXISTS "auth full access" ON public.processo_checklist_templates;
DROP POLICY IF EXISTS "auth full access" ON public.processo_itens;
DROP POLICY IF EXISTS "auth full access" ON public.processos_sei;
DROP POLICY IF EXISTS "auth full access" ON public.responsaveis_tecnicos;
DROP POLICY IF EXISTS "auth full access" ON public.unidades;

DROP POLICY IF EXISTS "admin read docs" ON storage.objects;
DROP POLICY IF EXISTS "admin upload docs" ON storage.objects;
DROP POLICY IF EXISTS "admin update docs" ON storage.objects;
DROP POLICY IF EXISTS "admin delete docs" ON storage.objects;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'atividade_log','checklist_itens','checklist_templates','cnaes_unidade',
    'documentos','ia_modelos','ia_uso','licencas','normativas',
    'notificacoes_vencimento','orgaos','processo_checklist_templates',
    'processo_itens','processos_sei','responsaveis_tecnicos','unidades','user_roles'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
