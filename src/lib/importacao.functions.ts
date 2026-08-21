import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";
import { requireEdicao } from "@/lib/acesso-middleware";
import { linhasImportacaoSchema, type LinhaImportacao } from "@/lib/importacao-schema";

/**
 * Importação de licenças a partir de planilha (CSV).
 *
 * Trabalha em dois tempos — pré-visualizar e só depois aplicar — porque uma
 * carga em massa que grave logo à primeira transforma um erro de coluna em
 * centenas de registos errados. A pré-visualização diz, linha a linha, o que
 * vai ser criado, atualizado ou rejeitado.
 */

export type ResultadoLinha = {
  linha: number;
  acao: "criar" | "atualizar" | "ignorar" | "erro";
  motivo?: string;
  unidade?: string;
  orgao?: string;
  descricao?: string;
  campos?: string[];
};

function normalizar(t: string | null | undefined) {
  return (t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const importarLicencas = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => linhasImportacaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { diferencas, registarAuditoria } = await import("@/lib/auditoria.server");

    const { data: unidades, error: erroUnidades } = await context.supabase
      .from("unidades")
      .select("id, nome, nome_fantasia, cnpj, numero_iges");
    if (erroUnidades) throw erroUnidades;

    const indice = new Map<string, string>();
    for (const u of unidades ?? []) {
      indice.set(normalizar(u.nome), u.id);
      if (u.nome_fantasia) indice.set(normalizar(u.nome_fantasia), u.id);
      if (u.cnpj) indice.set(u.cnpj.replace(/\D/g, ""), u.id);
      if (u.numero_iges !== null) indice.set(String(u.numero_iges), u.id);
    }

    const resultados: ResultadoLinha[] = [];

    for (const [i, l] of data.linhas.entries()) {
      const numeroLinha = i + 2; // cabeçalho é a linha 1 na planilha
      const chave = /^\d+$/.test(l.unidade.replace(/\D/g, "")) && l.unidade.replace(/\D/g, "")
        ? (indice.get(l.unidade.replace(/\D/g, "")) ?? indice.get(normalizar(l.unidade)))
        : indice.get(normalizar(l.unidade));

      if (!chave) {
        resultados.push({
          linha: numeroLinha,
          acao: "erro",
          motivo: `Unidade "${l.unidade}" não existe no sistema.`,
          unidade: l.unidade,
        });
        continue;
      }

      const registo = camposDaLinha(l);
      const { data: existente } = await context.supabase
        .from("licencas")
        .select("*")
        .eq("unidade_id", chave)
        .eq("orgao", l.orgao)
        .eq("descricao", l.descricao)
        .maybeSingle();

      const base: ResultadoLinha = {
        linha: numeroLinha,
        acao: "criar",
        unidade: l.unidade,
        orgao: l.orgao,
        descricao: l.descricao,
      };

      if (existente) {
        const mudancas = diferencas(existente, registo);
        if (mudancas.length === 0) {
          resultados.push({ ...base, acao: "ignorar", motivo: "Sem alterações." });
          continue;
        }
        base.acao = "atualizar";
        base.campos = mudancas.map((m) => m.campo);
        if (data.aplicar) {
          const { error } = await context.supabase
            .from("licencas")
            .update(registo)
            .eq("id", existente.id);
          if (error) {
            resultados.push({ ...base, acao: "erro", motivo: error.message });
            continue;
          }
          await registarAuditoria(context.supabase, {
            entidade: "licencas",
            entidade_id: existente.id,
            acao: "importar",
            alteracoes: mudancas,
            detalhes: { unidade: l.unidade, orgao: l.orgao, descricao: l.descricao },
          });
        }
        resultados.push(base);
        continue;
      }

      base.campos = Object.keys(registo);
      if (data.aplicar) {
        const { data: criada, error } = await context.supabase
          .from("licencas")
          .insert({ ...registo, unidade_id: chave, orgao: l.orgao, descricao: l.descricao })
          .select("id")
          .single();
        if (error) {
          resultados.push({ ...base, acao: "erro", motivo: error.message });
          continue;
        }
        await registarAuditoria(context.supabase, {
          entidade: "licencas",
          entidade_id: criada.id,
          acao: "importar",
          alteracoes: diferencas(null, registo),
          detalhes: { unidade: l.unidade, orgao: l.orgao, descricao: l.descricao },
        });
      }
      resultados.push(base);
    }

    return {
      aplicado: data.aplicar,
      resultados,
      resumo: {
        criar: resultados.filter((r) => r.acao === "criar").length,
        atualizar: resultados.filter((r) => r.acao === "atualizar").length,
        ignorar: resultados.filter((r) => r.acao === "ignorar").length,
        erro: resultados.filter((r) => r.acao === "erro").length,
      },
    };
  });

/** Só os campos preenchidos entram na gravação: a planilha nunca apaga dados. */
function camposDaLinha(l: LinhaImportacao) {
  const registo: Partial<Database["public"]["Tables"]["licencas"]["Update"]> = {};
  if (l.status) registo.status = l.status;
  if (l.numero) registo.numero = l.numero;
  if (l.processo_sei) registo.processo_sei = l.processo_sei;
  if (l.data_emissao) registo.data_emissao = l.data_emissao;
  if (l.data_vencimento) registo.data_vencimento = l.data_vencimento;
  if (l.data_protocolo) registo.data_protocolo = l.data_protocolo;
  if (l.observacoes) registo.observacoes = l.observacoes;
  return registo;
}
