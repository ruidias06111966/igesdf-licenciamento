-- Excluir licenças de unidades desativadas da view do painel.
--
-- `deleteUnidade` faz remoção lógica (`ativa = false`) e `listUnidades` filtra
-- por `ativa`, mas a view fazia JOIN com `unidades` sem esse filtro. Resultado:
-- ao desativar uma unidade ela desaparecia do cadastro e dos seletores, mas as
-- suas licenças continuavam a contar nos KPIs do painel, na listagem global, no
-- calendário de vencimentos, nos relatórios de conformidade e nos alertas —
-- inflando os números e apontando para uma unidade que já não existia na
-- interface.
--
-- A lista de colunas é exatamente a da versão anterior: os tipos gerados em
-- src/integrations/supabase/types.ts descrevem esta view, e acrescentar colunas
-- aqui exigiria regerar esses tipos.

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

-- `CREATE OR REPLACE VIEW` preserva as opções existentes, mas reafirmamos o
-- security_invoker para a view nunca passar a correr com os privilégios do dono.
ALTER VIEW public.v_licencas_dashboard SET (security_invoker = true);

GRANT SELECT ON public.v_licencas_dashboard TO authenticated;


-- Impedir itens de checklist duplicados.
--
-- `getChecklist` semeia os itens a partir do template do órgão na primeira
-- abertura. Sem restrição de unicidade, duas abas (ou dois cliques rápidos) na
-- mesma licença corriam o INSERT em paralelo e o checklist ficava com cada item
-- em duplicado.
--
-- A desduplicação mantém, de cada grupo, o item com mais trabalho registado
-- (concluído antes de em curso, antes de pendente; com responsável antes de sem
-- responsável) e só usa a data de criação como desempate. Uma versão anterior
-- deste script mantinha simplesmente o mais antigo, o que podia apagar o item
-- onde o progresso tinha sido preenchido.
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

-- Índice total (não parcial) de propósito: o `on_conflict` do PostgREST só envia
-- a lista de colunas, e o Postgres não consegue inferir um índice parcial a
-- partir dela. Como o padrão é NULLS DISTINCT, itens avulsos (template_id nulo)
-- continuam a poder repetir-se na mesma licença.
CREATE UNIQUE INDEX IF NOT EXISTS uq_checklist_itens_licenca_template
  ON public.checklist_itens(licenca_id, template_id);
