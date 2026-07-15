
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'analista', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

-- Auto-atribui role admin ao primeiro utilizador (single-user simples)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ Unidades ============
CREATE TYPE public.tipo_unidade AS ENUM ('hospital','upa','administrativo','laboratorio','outro');

CREATE TABLE public.unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_iges INT,
  nome TEXT NOT NULL,
  tipo public.tipo_unidade NOT NULL DEFAULT 'hospital',
  cnpj TEXT,
  cf_df TEXT,
  processo_sei TEXT,
  endereco TEXT,
  regiao_administrativa TEXT,
  cnaes TEXT[] DEFAULT '{}',
  servicos_especiais TEXT[] DEFAULT '{}',
  situacao_edificacao TEXT DEFAULT 'operando',
  observacoes TEXT,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read unidades" ON public.unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write unidades" ON public.unidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_unidades_upd BEFORE UPDATE ON public.unidades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Órgãos e Licenças ============
CREATE TYPE public.orgao_licenciador AS ENUM (
  'VISA','CBMDF','IBRAM','SEOP','PCDF','SEAGRI','SEEDF','DEFESA_CIVIL',
  'CNES','ADM_REGIONAL','CRM','COREN','CRF','CNEN','ANVISA','JUCIS','OUTRO'
);
CREATE TYPE public.status_licenca AS ENUM (
  'nao_iniciado','em_analise','aguardando_orgao','vigente','a_vencer','vencida',
  'indeferida','dispensada','pendente_declaracao','em_estudo'
);

CREATE TABLE public.licencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  orgao public.orgao_licenciador NOT NULL,
  descricao TEXT,
  numero TEXT,
  processo_sei TEXT,
  status public.status_licenca NOT NULL DEFAULT 'nao_iniciado',
  data_emissao DATE,
  data_vencimento DATE,
  data_protocolo DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_licencas_unidade ON public.licencas(unidade_id);
CREATE INDEX idx_licencas_venc ON public.licencas(data_vencimento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licencas TO authenticated;
GRANT ALL ON public.licencas TO service_role;
ALTER TABLE public.licencas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read licencas" ON public.licencas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write licencas" ON public.licencas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_licencas_upd BEFORE UPDATE ON public.licencas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Responsáveis Técnicos ============
CREATE TABLE public.responsaveis_tecnicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  conselho TEXT,
  numero_registro TEXT,
  cargo TEXT,
  email TEXT,
  telefone TEXT,
  data_inicio DATE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis_tecnicos TO authenticated;
GRANT ALL ON public.responsaveis_tecnicos TO service_role;
ALTER TABLE public.responsaveis_tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read rt" ON public.responsaveis_tecnicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write rt" ON public.responsaveis_tecnicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_rt_upd BEFORE UPDATE ON public.responsaveis_tecnicos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Documentos ============
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licenca_id UUID REFERENCES public.licencas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'licenca',
  nome TEXT NOT NULL,
  descricao TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_lic ON public.documentos(licenca_id);
CREATE INDEX idx_doc_uni ON public.documentos(unidade_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read doc" ON public.documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write doc" ON public.documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ Log de atividades ============
CREATE TABLE public.atividade_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entidade TEXT NOT NULL,
  entidade_id UUID,
  acao TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_ent ON public.atividade_log(entidade, entidade_id);
GRANT SELECT, INSERT ON public.atividade_log TO authenticated;
GRANT ALL ON public.atividade_log TO service_role;
ALTER TABLE public.atividade_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read log" ON public.atividade_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert log" ON public.atividade_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ Notificações de vencimento (histórico) ============
CREATE TABLE public.notificacoes_vencimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licenca_id UUID NOT NULL REFERENCES public.licencas(id) ON DELETE CASCADE,
  dias_antes INT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  destinatario TEXT NOT NULL,
  UNIQUE(licenca_id, dias_antes)
);
GRANT SELECT, INSERT ON public.notificacoes_vencimento TO authenticated;
GRANT ALL ON public.notificacoes_vencimento TO service_role;
ALTER TABLE public.notificacoes_vencimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read notif" ON public.notificacoes_vencimento FOR SELECT TO authenticated USING (true);

-- ============ View: status calculado ============
CREATE OR REPLACE VIEW public.v_licencas_dashboard AS
SELECT l.*,
  u.nome AS unidade_nome, u.numero_iges, u.tipo AS unidade_tipo, u.cnpj AS unidade_cnpj,
  CASE
    WHEN l.status IN ('indeferida','dispensada') THEN l.status::text
    WHEN l.data_vencimento IS NULL THEN COALESCE(l.status::text,'sem_data')
    WHEN l.data_vencimento < CURRENT_DATE THEN 'vencida'
    WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '60 days' THEN 'a_vencer_critico'
    WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '90 days' THEN 'a_vencer_alerta'
    ELSE 'vigente'
  END AS semaforo,
  (l.data_vencimento - CURRENT_DATE) AS dias_restantes
FROM public.licencas l
JOIN public.unidades u ON u.id = l.unidade_id;

GRANT SELECT ON public.v_licencas_dashboard TO authenticated;
