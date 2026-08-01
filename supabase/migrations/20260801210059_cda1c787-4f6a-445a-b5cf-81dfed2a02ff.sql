-- ============ Processos SEI ============
CREATE TABLE public.processos_sei (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  numero text NOT NULL,
  assunto text,
  tipo text NOT NULL DEFAULT 'licenciamento',
  orgao public.orgao_licenciador,
  licenca_id uuid REFERENCES public.licencas(id) ON DELETE SET NULL,
  situacao text NOT NULL DEFAULT 'em_andamento',
  data_abertura date,
  data_conclusao date,
  link text,
  responsavel text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos_sei TO authenticated;
GRANT ALL ON public.processos_sei TO service_role;
ALTER TABLE public.processos_sei ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON public.processos_sei FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_processos_sei_updated_at BEFORE UPDATE ON public.processos_sei
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_processos_sei_unidade ON public.processos_sei(unidade_id);

-- ============ Modelos de documentação por órgão ============
CREATE TABLE public.processo_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao public.orgao_licenciador NOT NULL,
  ordem integer NOT NULL,
  titulo text NOT NULL,
  descricao text,
  obrigatorio boolean NOT NULL DEFAULT true,
  responsavel_padrao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_checklist_templates TO authenticated;
GRANT ALL ON public.processo_checklist_templates TO service_role;
ALTER TABLE public.processo_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON public.processo_checklist_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ Itens de checklist do processo ============
CREATE TABLE public.processo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos_sei(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.processo_checklist_templates(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  orgao public.orgao_licenciador,
  obrigatorio boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  situacao text NOT NULL DEFAULT 'pendente',
  responsavel text,
  prazo date,
  data_entrega date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_itens TO authenticated;
GRANT ALL ON public.processo_itens TO service_role;
ALTER TABLE public.processo_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON public.processo_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_processo_itens_updated_at BEFORE UPDATE ON public.processo_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_processo_itens_processo ON public.processo_itens(processo_id);
CREATE UNIQUE INDEX uq_processo_itens_template ON public.processo_itens(processo_id, template_id) WHERE template_id IS NOT NULL;

-- ============ Documentos ligados a processos ============
ALTER TABLE public.documentos
  ADD COLUMN processo_id uuid REFERENCES public.processos_sei(id) ON DELETE CASCADE,
  ADD COLUMN processo_item_id uuid REFERENCES public.processo_itens(id) ON DELETE SET NULL;

CREATE INDEX idx_documentos_processo ON public.documentos(processo_id);

-- ============ Modelos de documentação ============
INSERT INTO public.processo_checklist_templates (orgao, ordem, titulo, descricao, obrigatorio, responsavel_padrao) VALUES
-- VISADF
('VISA', 1, 'Requerimento de licença sanitária', 'Formulário de requerimento assinado pelo representante legal.', true, 'Licenciamento'),
('VISA', 2, 'Cartão CNPJ atualizado', 'Comprovante de inscrição e situação cadastral com os CNAEs sanitários.', true, 'Contabilidade'),
('VISA', 3, 'Contrato social / ato constitutivo', 'Última alteração consolidada.', true, 'Jurídico'),
('VISA', 4, 'Alvará de funcionamento', 'Emitido pela Administração Regional ou DF LEGAL.', true, 'Licenciamento'),
('VISA', 5, 'Certificado de Vistoria do CBMDF', 'CVCB vigente da edificação.', true, 'Engenharia'),
('VISA', 6, 'Responsabilidade técnica (RT)', 'Termo de assunção de RT com registro no conselho de classe.', true, 'RH / Assistencial'),
('VISA', 7, 'Certidão de regularidade do conselho', 'CRT do conselho profissional do responsável técnico.', true, 'RH / Assistencial'),
('VISA', 8, 'Projeto arquitetônico aprovado', 'Projeto básico de arquitetura aprovado pela vigilância sanitária.', true, 'Engenharia'),
('VISA', 9, 'Memorial descritivo', 'Descrição das atividades, fluxos e estrutura física.', true, 'Engenharia'),
('VISA', 10, 'PGRSS', 'Plano de Gerenciamento de Resíduos de Serviços de Saúde.', true, 'Qualidade'),
('VISA', 11, 'Contrato de coleta de resíduos', 'Empresa licenciada para resíduos dos grupos A, B e E.', true, 'Suprimentos'),
('VISA', 12, 'Laudo de potabilidade da água', 'Análise laboratorial dentro da validade.', true, 'Manutenção'),
('VISA', 13, 'Comprovante de pagamento da taxa', 'DAR quitado referente ao licenciamento sanitário.', true, 'Financeiro'),
-- CBMDF
('CBMDF', 1, 'Requerimento de vistoria', 'Solicitação de vistoria para emissão do CVCB.', true, 'Engenharia'),
('CBMDF', 2, 'Projeto de segurança contra incêndio aprovado', 'Projeto aprovado pelo CBMDF com ART/RRT.', true, 'Engenharia'),
('CBMDF', 3, 'ART/RRT do responsável técnico', 'Anotação de responsabilidade técnica quitada.', true, 'Engenharia'),
('CBMDF', 4, 'Atestado de brigada de incêndio', 'Comprovação de formação da brigada e treinamento.', true, 'SESMT'),
('CBMDF', 5, 'Laudo de extintores e hidrantes', 'Relatório de manutenção e recarga dentro da validade.', true, 'Manutenção'),
('CBMDF', 6, 'Laudo do sistema de detecção e alarme', 'Manutenção e teste dos sistemas de alarme.', true, 'Manutenção'),
('CBMDF', 7, 'Laudo de iluminação e sinalização de emergência', 'Relatório técnico de conformidade.', true, 'Manutenção'),
('CBMDF', 8, 'Laudo do sistema de SPDA', 'Sistema de proteção contra descargas atmosféricas.', true, 'Manutenção'),
('CBMDF', 9, 'Comprovante de pagamento da taxa', 'DAR quitado da vistoria.', true, 'Financeiro'),
-- IBRAM
('IBRAM', 1, 'Requerimento de licença ambiental', 'Formulário de abertura junto ao IBRAM.', true, 'Qualidade'),
('IBRAM', 2, 'Formulário de caracterização do empreendimento', 'FCE preenchido e assinado.', true, 'Qualidade'),
('IBRAM', 3, 'Plano de gerenciamento de resíduos', 'PGRS/PGRSS com destinação final comprovada.', true, 'Qualidade'),
('IBRAM', 4, 'Outorga ou comprovante de abastecimento de água', 'Contrato CAESB ou outorga de poço.', true, 'Manutenção'),
('IBRAM', 5, 'Comprovante de destinação de efluentes', 'Ligação à rede ou sistema licenciado.', true, 'Manutenção'),
('IBRAM', 6, 'ART do responsável técnico ambiental', 'Anotação de responsabilidade técnica quitada.', true, 'Qualidade'),
('IBRAM', 7, 'Comprovante de pagamento da taxa', 'DAR quitado do licenciamento ambiental.', true, 'Financeiro'),
-- DF LEGAL
('DF_LEGAL', 1, 'Requerimento de alvará de funcionamento', 'Pedido via Portal REDESIM.', true, 'Licenciamento'),
('DF_LEGAL', 2, 'Cartão CNPJ com CNAEs', 'Situação cadastral atualizada.', true, 'Contabilidade'),
('DF_LEGAL', 3, 'Carta de Habite-se ou Atestado de Conclusão', 'Documento da edificação.', true, 'Engenharia'),
('DF_LEGAL', 4, 'Documento de propriedade ou contrato de locação', 'Comprovação da posse do imóvel.', true, 'Jurídico'),
('DF_LEGAL', 5, 'Certificado de Vistoria do CBMDF', 'CVCB vigente.', true, 'Engenharia'),
('DF_LEGAL', 6, 'Licença sanitária', 'Emitida pela VISADF quando exigível.', true, 'Licenciamento'),
('DF_LEGAL', 7, 'Comprovante de pagamento da taxa', 'DAR quitado.', true, 'Financeiro'),
-- SUSDEC
('SUSDEC', 1, 'Requerimento de vistoria da Defesa Civil', 'Solicitação de vistoria da edificação.', true, 'Engenharia'),
('SUSDEC', 2, 'Laudo de estabilidade estrutural', 'Laudo com ART do engenheiro responsável.', true, 'Engenharia'),
('SUSDEC', 3, 'Plano de contingência e evacuação', 'Plano de emergência aprovado internamente.', true, 'SESMT'),
('SUSDEC', 4, 'Comprovante de pagamento da taxa', 'DAR quitado quando aplicável.', false, 'Financeiro'),
-- Administração Regional
('ADM_REGIONAL', 1, 'Requerimento à Administração Regional', 'Pedido de anuência ou alvará local.', true, 'Licenciamento'),
('ADM_REGIONAL', 2, 'Croqui de localização', 'Planta de situação do imóvel.', true, 'Engenharia'),
('ADM_REGIONAL', 3, 'Documento de propriedade ou concessão de uso', 'Comprovação da posse do terreno.', true, 'Jurídico'),
('ADM_REGIONAL', 4, 'Comprovante de pagamento da taxa', 'DAR quitado quando aplicável.', false, 'Financeiro'),
-- CNES
('CNES', 1, 'Ficha de cadastro do estabelecimento', 'FCES preenchida no sistema CNES.', true, 'Assistencial'),
('CNES', 2, 'Alvará de funcionamento', 'Documento vigente do estabelecimento.', true, 'Licenciamento'),
('CNES', 3, 'Licença sanitária', 'Documento vigente da VISADF.', true, 'Licenciamento'),
('CNES', 4, 'Relação de profissionais e registros', 'Quadro de profissionais com conselhos de classe.', true, 'RH'),
('CNES', 5, 'Relação de equipamentos e leitos', 'Inventário atualizado para cadastro no CNES.', true, 'Assistencial');