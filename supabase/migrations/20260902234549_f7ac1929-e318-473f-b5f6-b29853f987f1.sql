CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cada conta nova entra logo na lista de acessos, sem perfil (pendente),
  -- para o master a poder autorizar mesmo antes de a pessoa abrir o sistema.
  INSERT INTO public.perfis_acesso (user_id, email, nome, perfil, autorizado_em)
  VALUES (
    NEW.id,
    lower(COALESCE(NEW.email, '')),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', '')), ''),
    CASE WHEN lower(COALESCE(NEW.email, '')) = 'qidominio@gmail.com' THEN 'master' ELSE NULL END,
    CASE WHEN lower(COALESCE(NEW.email, '')) = 'qidominio@gmail.com' THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca impedir a criação da conta por causa deste registo.
  RETURN NEW;
END;
$$;

-- Contas já existentes sem registo na lista de acessos.
INSERT INTO public.perfis_acesso (user_id, email, nome, perfil, autorizado_em)
SELECT u.id,
       lower(u.email),
       NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'full_name', '')), ''),
       NULL,
       NULL
FROM auth.users u
LEFT JOIN public.perfis_acesso p ON p.user_id = u.id
WHERE u.email IS NOT NULL
  AND p.user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.perfis_acesso p2 WHERE lower(p2.email) = lower(u.email))
ON CONFLICT (user_id) DO NOTHING;