CREATE TABLE public.ia_uso (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil text NOT NULL,
  acao text NOT NULL,
  tokens_entrada integer NOT NULL DEFAULT 0,
  tokens_saida integer NOT NULL DEFAULT 0,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.ia_uso TO service_role;

ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;

CREATE INDEX ia_uso_criado_em_idx ON public.ia_uso (criado_em DESC);