CREATE OR REPLACE VIEW public.v_licencas_dashboard AS
SELECT l.*,
  u.nome AS unidade_nome, u.numero_iges, u.tipo AS unidade_tipo, u.cnpj AS unidade_cnpj,
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

ALTER VIEW public.v_licencas_dashboard SET (security_invoker = true);

GRANT SELECT ON public.v_licencas_dashboard TO authenticated;

WITH classificados AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY licenca_id, template_id
           ORDER BY
             CASE status
               WHEN 'concluido' THEN 0
               WHEN 'em_curso' THEN 1
               WHEN 'nao_aplicavel' THEN 2
               ELSE 3
             END,
             (data_conclusao IS NULL),
             (responsavel IS NULL),
             (observacoes IS NULL),
             created_at,
             id
         ) AS posicao
  FROM public.checklist_itens
  WHERE template_id IS NOT NULL
)
DELETE FROM public.checklist_itens c
USING classificados x
WHERE c.id = x.id
  AND x.posicao > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_checklist_itens_licenca_template
  ON public.checklist_itens(licenca_id, template_id);