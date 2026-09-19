-- Segunda etapa do multi-cliente: a que empresa pertence cada pessoa.
--
-- Também só aditiva. Cria colunas opcionais e preenche-as; não altera nem apaga
-- nada, e pode correr duas vezes.
--
-- O alcance de cada conta passa a vir de `perfis_acesso.empresa_id`:
--
--   perfil master  + empresa_id NULL  -> master global: vê tudo, gere empresas
--   perfil master  + empresa_id posto -> master da empresa: só essa empresa
--   edicao/leitura + empresa_id posto -> trabalha só nessa empresa
--
-- Não foi preciso perfil novo: o alcance é a empresa, não o perfil.

-- ---------------------------------------------------------------------------
-- 1. A empresa de cada conta
-- ---------------------------------------------------------------------------

ALTER TABLE public.perfis_acesso
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas (id);

CREATE INDEX IF NOT EXISTS perfis_acesso_empresa_id_idx
  ON public.perfis_acesso (empresa_id);

COMMENT ON COLUMN public.perfis_acesso.empresa_id IS
  'Empresa a que a conta pertence. NULL com perfil master significa master '
  'global (vê todas as empresas); NULL sem perfil é uma conta ainda por '
  'autorizar.';

-- As contas que já existem são todas do IGESDF, à exceção do master global, que
-- fica sem empresa para continuar a ver tudo.
UPDATE public.perfis_acesso
SET empresa_id = (SELECT id FROM public.empresas WHERE lower(sigla) = 'igesdf' LIMIT 1)
WHERE empresa_id IS NULL
  AND lower(email) <> lower(COALESCE(
    current_setting('app.master_email', true),
    'qidominio@gmail.com'
  ));

-- ---------------------------------------------------------------------------
-- 2. Tabelas que não chegam à empresa por nenhum caminho
-- ---------------------------------------------------------------------------

-- A auditoria guarda `entidade` + `entidade_id` sem chave estrangeira, e a
-- validação guarda um resumo com as pendências encontradas. Nenhuma das duas
-- consegue dizer de que empresa é a linha, e ambas seriam mostradas por inteiro
-- a qualquer master: a auditoria expunha quem mexeu no quê noutra empresa, e a
-- validação expunha as pendências dela. Passam a carregar a empresa.

ALTER TABLE public.atividade_log
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas (id);

CREATE INDEX IF NOT EXISTS atividade_log_empresa_id_idx
  ON public.atividade_log (empresa_id);

ALTER TABLE public.validacao_execucoes
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas (id);

CREATE INDEX IF NOT EXISTS validacao_execucoes_empresa_id_idx
  ON public.validacao_execucoes (empresa_id);

-- Os modelos do assistente de IA têm unidade e processo opcionais: um modelo
-- geral não tem nem uma nem outro, e assim não teria por onde chegar à empresa.
-- Como o conteúdo é texto escrito por gente da empresa, leva coluna própria.
ALTER TABLE public.ia_modelos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas (id);

CREATE INDEX IF NOT EXISTS ia_modelos_empresa_id_idx
  ON public.ia_modelos (empresa_id);

-- O histórico que já existe é todo do IGESDF.
UPDATE public.atividade_log
SET empresa_id = (SELECT id FROM public.empresas WHERE lower(sigla) = 'igesdf' LIMIT 1)
WHERE empresa_id IS NULL;

UPDATE public.validacao_execucoes
SET empresa_id = (SELECT id FROM public.empresas WHERE lower(sigla) = 'igesdf' LIMIT 1)
WHERE empresa_id IS NULL;

-- Os modelos já ligados a uma unidade herdam a empresa dela; os gerais ficam
-- com o IGESDF, que é de quem são.
UPDATE public.ia_modelos m
SET empresa_id = COALESCE(
  (SELECT u.empresa_id FROM public.unidades u WHERE u.id = m.unidade_id),
  (SELECT id FROM public.empresas WHERE lower(sigla) = 'igesdf' LIMIT 1)
)
WHERE m.empresa_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. A view do painel precisa de mostrar a empresa
-- ---------------------------------------------------------------------------

-- Sem esta coluna, `listDashboard` não tem por onde filtrar: o painel, as
-- listas de licenças, o calendário e os relatórios saem todos daqui.
-- Esta é a definição em vigor (migração 20260730121730) com uma única linha
-- acrescentada: `u.empresa_id`. Os limiares do semáforo, o `dias_restantes` e
-- as colunas da unidade ficam exatamente como estavam — mexer neles aqui
-- mudava calados os números do painel.
CREATE OR REPLACE VIEW public.v_licencas_dashboard AS
SELECT l.*,
  u.nome AS unidade_nome, u.numero_iges, u.tipo AS unidade_tipo, u.cnpj AS unidade_cnpj,
  u.empresa_id,
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
JOIN public.unidades u ON u.id = l.unidade_id
WHERE u.ativa;
