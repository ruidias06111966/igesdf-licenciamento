CREATE TABLE public.normativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'rdc',
  numero text NOT NULL,
  ano integer,
  orgao_sigla text NOT NULL DEFAULT 'ANVISA',
  titulo text NOT NULL,
  ementa text,
  ambito text NOT NULL DEFAULT 'federal',
  aplicacao text[] NOT NULL DEFAULT '{}'::text[],
  data_publicacao date,
  situacao text NOT NULL DEFAULT 'vigente',
  link text,
  storage_path text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  principal boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.normativas TO authenticated;
GRANT ALL ON public.normativas TO service_role;

ALTER TABLE public.normativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access" ON public.normativas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_normativas_updated_at
  BEFORE UPDATE ON public.normativas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_normativas_tipo ON public.normativas(tipo);
CREATE INDEX idx_normativas_orgao ON public.normativas(orgao_sigla);