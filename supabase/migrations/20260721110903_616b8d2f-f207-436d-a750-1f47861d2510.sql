
CREATE TABLE public.orgaos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sigla TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT,
  site TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orgaos TO authenticated;
GRANT ALL ON public.orgaos TO service_role;

ALTER TABLE public.orgaos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read orgaos"
  ON public.orgaos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin insert orgaos"
  ON public.orgaos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update orgaos"
  ON public.orgaos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete orgaos"
  ON public.orgaos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER orgaos_set_updated_at
  BEFORE UPDATE ON public.orgaos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.orgaos (sigla, nome, categoria) VALUES
  ('DF LEGAL', 'Secretaria de Estado de Proteção da Ordem Urbanística do Distrito Federal', 'Ordem urbanística / uso do solo'),
  ('SUSDEC',   'Subsecretaria do Sistema de Defesa Civil',                                  'Defesa civil'),
  ('CBMDF',    'Corpo de Bombeiros Militar do Distrito Federal',                            'Segurança contra incêndio e pânico'),
  ('IBRAM',    'Instituto Brasília Ambiental',                                              'Licenciamento ambiental'),
  ('VISADF',   'Vigilância Sanitária do Distrito Federal',                                  'Vigilância sanitária'),
  ('PCDF',     'Polícia Civil do Distrito Federal',                                         'Segurança pública / licenciamento PCDF'),
  ('SEAGRI',   'Secretaria de Estado da Agricultura, Abastecimento e Desenvolvimento Rural','Serviços de alimentação / nutrição'),
  ('SEEDF',    'Secretaria de Estado de Educação do Distrito Federal',                      'Educação');
