CREATE TABLE public.perfis_acesso (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  nome text,
  perfil text CHECK (perfil IN ('master','edicao','leitura')),
  suspenso boolean NOT NULL DEFAULT false,
  autorizado_por uuid,
  autorizado_em timestamptz,
  ultimo_acesso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX perfis_acesso_email_key ON public.perfis_acesso (lower(email));

GRANT ALL ON public.perfis_acesso TO service_role;

ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_perfis_acesso_uat
BEFORE UPDATE ON public.perfis_acesso
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();