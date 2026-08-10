CREATE TABLE public.ia_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'despacho',
  conteudo text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  processo_id uuid REFERENCES public.processos_sei(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ia_modelos TO service_role;

ALTER TABLE public.ia_modelos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_ia_modelos_updated_at
BEFORE UPDATE ON public.ia_modelos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();