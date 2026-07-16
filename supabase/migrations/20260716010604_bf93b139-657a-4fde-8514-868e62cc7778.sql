
-- 1. Versionamento de documentos: colunas para arquivo histórico
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS documento_pai_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comentario_versao text;
CREATE INDEX IF NOT EXISTS idx_doc_pai ON public.documentos(documento_pai_id);
CREATE INDEX IF NOT EXISTS idx_doc_ativo ON public.documentos(ativo);

-- 2. CNAEs por unidade (VISA)
CREATE TABLE public.cnaes_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  descricao text NOT NULL,
  cnpj_ses_legado text,
  status status_licenca NOT NULL DEFAULT 'pendente_declaracao',
  data_vencimento date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, codigo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnaes_unidade TO authenticated;
GRANT ALL ON public.cnaes_unidade TO service_role;
ALTER TABLE public.cnaes_unidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read cnaes" ON public.cnaes_unidade FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin write cnaes" ON public.cnaes_unidade FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cnaes_uat BEFORE UPDATE ON public.cnaes_unidade FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_cnaes_uni ON public.cnaes_unidade(unidade_id);

-- 3. Templates de checklist por órgão
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao orgao_licenciador NOT NULL,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'documento', -- 'documento' | 'etapa'
  responsavel_padrao text,
  obrigatorio boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read tpl" ON public.checklist_templates FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- 4. Itens de checklist por licença (instância)
CREATE TABLE public.checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licenca_id uuid NOT NULL REFERENCES public.licencas(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'documento',
  ordem integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente', -- pendente|em_curso|concluido|nao_aplicavel
  responsavel text,
  data_conclusao date,
  observacoes text,
  concluido_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_itens TO authenticated;
GRANT ALL ON public.checklist_itens TO service_role;
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read cki" ON public.checklist_itens FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin write cki" ON public.checklist_itens FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cki_uat BEFORE UPDATE ON public.checklist_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_cki_lic ON public.checklist_itens(licenca_id);

-- 5. Seed templates por órgão
INSERT INTO public.checklist_templates (orgao, ordem, titulo, descricao, tipo, responsavel_padrao, obrigatorio) VALUES
-- VISA (DIVISA/SES-DF)
('VISA', 10, 'Projeto Básico de Arquitetura aprovado', 'PBA aprovado pela DIVISA (Risco III exige)', 'documento', 'Engenharia/Arquitetura', true),
('VISA', 20, 'Termo de Responsabilidade Técnica (TRT)', 'TRT assinado por RT com registo no conselho', 'documento', 'Responsável Técnico', true),
('VISA', 30, 'Certificado do Corpo de Bombeiros vigente', 'Anexar CBMDF em vigor', 'documento', 'Compliance', true),
('VISA', 40, 'PGRSS aprovado pelo IBRAM', 'Plano de Gerenciamento de Resíduos de Serviços de Saúde', 'documento', 'Ambiental', true),
('VISA', 50, 'Relação de CNAEs por atividade', 'Detalhe dos CNAEs licenciados por unidade', 'documento', 'Compliance', true),
('VISA', 60, 'Protocolo do requerimento (DIVISA)', 'Protocolo SEI/e-Sanitas', 'etapa', 'Compliance', true),
('VISA', 70, 'Vistoria sanitária realizada', 'Data e ata de vistoria', 'etapa', 'Compliance', true),
('VISA', 80, 'Publicação/emissão do Certificado', 'Certificado de Licenciamento Sanitário emitido', 'etapa', 'Compliance', true),

-- CBMDF
('CBMDF', 10, 'PPCI aprovado', 'Projeto Preventivo Contra Incêndio', 'documento', 'Engenharia', true),
('CBMDF', 20, 'ART/RRT do responsável técnico', 'Registo do CREA/CAU', 'documento', 'Engenharia', true),
('CBMDF', 30, 'Comprovante de manutenção de sistemas', 'Extintores, hidrantes, alarme, iluminação de emergência', 'documento', 'Manutenção', true),
('CBMDF', 40, 'Requerimento via INOVA', 'Protocolo eletrónico CBMDF', 'etapa', 'Compliance', true),
('CBMDF', 50, 'Vistoria realizada', 'Data da vistoria CBMDF', 'etapa', 'Compliance', true),
('CBMDF', 60, 'Emissão do Atestado de Vistoria', 'Documento final CBMDF (Risco III)', 'etapa', 'Compliance', true),

-- IBRAM
('IBRAM', 10, 'PGRSS elaborado por profissional habilitado', 'IN IBRAM nº 12/2019', 'documento', 'Ambiental', true),
('IBRAM', 20, 'ART do responsável pelo PGRSS', 'ART CREA', 'documento', 'Ambiental', true),
('IBRAM', 30, 'Contratos com empresas coletoras (Grupos A,B,E)', 'Contratos vigentes de coleta/tratamento', 'documento', 'Ambiental', true),
('IBRAM', 40, 'Comprovantes MTR — Manifesto de Transporte de Resíduos', 'MTRs dos últimos 12 meses', 'documento', 'Ambiental', true),
('IBRAM', 50, 'Protocolo de licença ambiental', 'Requerimento no sistema IBRAM', 'etapa', 'Ambiental', true),
('IBRAM', 60, 'Vistoria/análise técnica concluída', '', 'etapa', 'Ambiental', true),
('IBRAM', 70, 'Emissão da Licença Ambiental', 'LO/LI/LP conforme fase', 'etapa', 'Compliance', true),

-- CNES / DATASUS
('CNES', 10, 'Cadastro CNPJ e endereço confirmados', 'Dados alinhados com Receita Federal', 'etapa', 'Compliance', true),
('CNES', 20, 'Ficha de Cadastro do Estabelecimento (FCES)', 'Preenchimento no SCNES', 'documento', 'Regulação', true),
('CNES', 30, 'Cadastro de profissionais e equipes', 'CBOs e vínculos', 'etapa', 'RH/Regulação', true),
('CNES', 40, 'Cadastro de leitos e serviços', 'Serviços especializados e habilitações', 'etapa', 'Regulação', true),
('CNES', 50, 'Envio da competência mensal', 'BDSIA/SISAB', 'etapa', 'Regulação', true),

-- Administração Regional
('ADM_REGIONAL', 10, 'Consulta prévia de viabilidade (SEPROT-DF)', 'Confirmar uso do solo antes do requerimento', 'etapa', 'Compliance', true),
('ADM_REGIONAL', 20, 'Cópia do CNPJ ativo', 'Emissão RFB', 'documento', 'Compliance', true),
('ADM_REGIONAL', 30, 'CF/DF ativo', 'Inscrição Cadastro Fiscal DF', 'documento', 'Fiscal', true),
('ADM_REGIONAL', 40, 'Certificado CBMDF vigente', 'Anexar AVCB', 'documento', 'Compliance', true),
('ADM_REGIONAL', 50, 'Certificado Sanitário (DIVISA) vigente', 'Anexar licença VISA', 'documento', 'Compliance', true),
('ADM_REGIONAL', 60, 'Requerimento de Licença de Funcionamento', 'Protocolo junto à Adm. Regional', 'etapa', 'Compliance', true),
('ADM_REGIONAL', 70, 'Emissão da Licença de Funcionamento', 'Alvará emitido', 'etapa', 'Compliance', true);

-- 6. Seed CNAEs para as UPAs conforme planilha
DO $$
DECLARE
  cnaes text[][] := ARRAY[
    ['86.10-1-02','Atividades de atendimento em pronto-socorro e unidades hospitalares para atendimento a urgências'],
    ['86.30-5-02','Atividade médica ambulatorial com recursos para realização de exames complementares'],
    ['86.40-2-02','Laboratórios clínicos'],
    ['86.40-2-05','Serviços de diagnóstico por imagem com uso de radiação ionizante, exceto tomografia']
  ];
  upas text[][] := ARRAY[
    ['28.481.233/0016-59','00.394.700/0040-14'], -- Vicente Pires
    ['28.481.233/0015-78','00.394.700/0043-67'], -- Planaltina
    ['28.481.233/0014-97','00.394.700/0044-48'], -- Brazlândia
    ['28.481.233/0003-34','00.394.700/0036-38'], -- Ceilândia
    ['28.481.233/0011-44','00.394.700/0038-08'], -- Ceilândia II
    ['28.481.233/0012-25','00.394.700/0041-03'], -- Gama
    ['28.481.233/0018-10','00.394.700/0034-76'], -- N. Bandeirante
    ['28.481.233/0010-63','00.394.700/0039-80'], -- Paranoá
    ['28.481.233/0004-15','00.394.700/0035-57'], -- Recanto
    ['28.481.233/0013-06','00.394.700/0042-86'], -- Riacho Fundo II
    ['28.481.233/0006-87','00.394.700/0033-95'], -- S. Sebastião
    ['28.481.233/0005-04','00.394.700/0029-09'], -- Samambaia
    ['28.481.233/0008-49','00.394.700/0037-19']  -- Sobradinho
  ];
  u text[];
  c text[];
  uni_id uuid;
BEGIN
  FOREACH u SLICE 1 IN ARRAY upas LOOP
    SELECT id INTO uni_id FROM public.unidades WHERE cnpj = u[1] LIMIT 1;
    IF uni_id IS NOT NULL THEN
      FOREACH c SLICE 1 IN ARRAY cnaes LOOP
        INSERT INTO public.cnaes_unidade (unidade_id, codigo, descricao, cnpj_ses_legado, status)
        VALUES (uni_id, c[1], c[2], u[2], 'pendente_declaracao')
        ON CONFLICT (unidade_id, codigo) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;
