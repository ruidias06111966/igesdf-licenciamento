import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAcesso, requireEdicao } from "@/lib/acesso-middleware";
import type { ExecucaoValidacao, ResultadoValidacao } from "@/lib/validacao";

/**
 * Validação do sistema: conferências de coerência dos dados, com histórico das
 * execuções e correções em lote a partir do resultado.
 */

export const executarValidacao = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .handler(async ({ context }): Promise<ResultadoValidacao> => {
    const { coletarProblemas } = await import("@/lib/validacao.server");
    const resultado = await coletarProblemas(context.supabase);

    await context.supabase.from("validacao_execucoes").insert({
      executado_por: context.sessao.email,
      total_problemas: resultado.total_problemas,
      total_itens: resultado.total_itens,
      resumo: resultado.grupos.map((g) => ({
        chave: g.chave,
        titulo: g.titulo,
        severidade: g.severidade,
        total: g.total,
      })),
    });

    return resultado;
  });

export const listarExecucoesValidacao = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .handler(async ({ context }): Promise<ExecucaoValidacao[]> => {
    const { data, error } = await context.supabase
      .from("validacao_execucoes")
      .select("id, executado_em, executado_por, total_problemas, total_itens")
      .order("executado_em", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

/**
 * Corrige em lote a situação das licenças escolhidas no painel.
 *
 * Só aceita os estados que fazem sentido para os achados da validação — não é
 * uma porta genérica para alterar qualquer licença.
 */
export const corrigirSituacaoLicencas = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        status: z.enum(["dispensada", "nao_iniciado", "em_estudo"]),
        motivo: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: antes, error: erroLeitura } = await context.supabase
      .from("licencas")
      .select("id, status, orgao, unidade_id")
      .in("id", data.ids);
    if (erroLeitura) throw erroLeitura;

    const { error } = await context.supabase
      .from("licencas")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw error;

    const { registarAuditoria } = await import("@/lib/auditoria.server");
    await registarAuditoria(context.supabase, {
      entidade: "licencas",
      acao: "atualizar",
      alteracoes: [
        {
          campo: "status",
          antes: `${antes?.length ?? 0} licença(s) revistas na validação`,
          depois: data.status,
        },
      ],
      detalhes: {
        origem: "painel_validacao",
        motivo: data.motivo ?? null,
        ids: data.ids,
      },
    });

    return { atualizadas: data.ids.length };
  });
