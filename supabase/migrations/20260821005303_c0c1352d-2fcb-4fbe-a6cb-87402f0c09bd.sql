-- 1. Auditoria: perfil e campos alterados
ALTER TABLE public.atividade_log
  ADD COLUMN IF NOT EXISTS perfil text,
  ADD COLUMN IF NOT EXISTS alteracoes jsonb;

CREATE INDEX IF NOT EXISTS atividade_log_created_idx ON public.atividade_log (created_at DESC);
CREATE INDEX IF NOT EXISTS atividade_log_entidade_idx ON public.atividade_log (entidade, entidade_id);

GRANT ALL ON public.atividade_log TO service_role;

-- 2. Biblioteca de modelos: classificação e versionamento
ALTER TABLE public.ia_modelos
  ADD COLUMN IF NOT EXISTS orgao public.orgao_licenciador,
  ADD COLUMN IF NOT EXISTS tipo_unidade public.tipo_unidade,
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.ia_modelo_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id uuid NOT NULL REFERENCES public.ia_modelos(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  comentario text,
  perfil text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modelo_id, versao)
);

GRANT ALL ON public.ia_modelo_versoes TO service_role;
ALTER TABLE public.ia_modelo_versoes ENABLE ROW LEVEL SECURITY;
-- Sem políticas: o acesso é feito exclusivamente pelas funções de servidor
-- com a service role, tal como nas restantes tabelas do sistema.