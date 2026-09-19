import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Sessao } from "@/lib/acesso.server";

/**
 * Alcance de uma sessão sobre os dados.
 *
 * Todas as tabelas de cliente chegam à empresa por um de dois caminhos: têm
 * `empresa_id` (unidades, a view do painel, auditoria, validação) ou pendem de
 * uma unidade (licenças, documentos, processos, responsáveis técnicos, CNAEs).
 * Este módulo é o único sítio onde esse filtro é escrito — as funções de
 * servidor pedem-lho em vez de o repetirem, e um teste garante que nenhuma
 * função vai à tabela sem passar por aqui.
 *
 * Sobre-filtrar mostra de menos e vê-se logo; sub-filtrar mostra dados de outro
 * cliente e não se vê. Por isso, na dúvida, estas funções recusam em vez de
 * deixarem passar.
 */

type Cliente = SupabaseClient<Database>;

export type Escopo = { global: true; empresaId: null } | { global: false; empresaId: string };

/**
 * Traduz a sessão em alcance.
 *
 * Uma conta autorizada sem empresa atribuída e sem ser master global não tem
 * alcance nenhum — é um estado que não devia existir, e aqui recusa-se em vez
 * de se assumir "vê tudo", que é como um descuido destes vira fuga de dados.
 */
export function escopoDaSessao(sessao: Sessao): Escopo {
  if (sessao.perfil === "master" && sessao.empresaId === null) {
    return { global: true, empresaId: null };
  }
  if (!sessao.empresaId) {
    throw new Error(
      "A sua conta não está associada a nenhuma empresa. Peça ao responsável pelo sistema para a atribuir.",
    );
  }
  return { global: false, empresaId: sessao.empresaId };
}

/** Consulta com `.eq`, sem depender dos genéricos internos do supabase-js. */
type ComEq<Q> = Q & { eq(coluna: string, valor: string): Q };
/** Consulta com `.in`. */
type ComIn<Q> = Q & { in(coluna: string, valores: readonly string[]): Q };

/**
 * Filtra uma tabela que tem `empresa_id` próprio.
 * Usar em `unidades`, `v_licencas_dashboard`, `atividade_log`,
 * `validacao_execucoes`.
 */
export function daEmpresa<Q>(consulta: ComEq<Q>, escopo: Escopo): Q {
  return escopo.global ? consulta : consulta.eq("empresa_id", escopo.empresaId);
}

/**
 * Ids das unidades ao alcance da sessão, ou `null` para o master global.
 *
 * `null` quer dizer "sem filtro" e não "nenhuma": quem chama tem de distinguir
 * os dois, e é por isso que devolve `null` em vez de uma lista vazia.
 */
export async function unidadesDoEscopo(
  supabase: Cliente,
  escopo: Escopo,
): Promise<string[] | null> {
  if (escopo.global) return null;
  const { data, error } = await supabase
    .from("unidades")
    .select("id")
    .eq("empresa_id", escopo.empresaId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((u) => u.id);
}

/**
 * Filtra uma tabela que pende de uma unidade.
 *
 * Com a lista vazia usa-se um id impossível em vez de devolver a consulta sem
 * filtro: `.in("unidade_id", [])` no PostgREST devolveria tudo, e uma empresa
 * sem unidades passaria a ver as de toda a gente.
 */
export function dasUnidades<Q>(consulta: ComIn<Q>, ids: string[] | null, coluna = "unidade_id"): Q {
  if (ids === null) return consulta;
  return consulta.in(coluna, ids.length > 0 ? ids : [IMPOSSIVEL]);
}

const IMPOSSIVEL = "00000000-0000-0000-0000-000000000000";

/**
 * Confirma que a unidade está ao alcance, antes de gravar ou apagar.
 *
 * As leituras filtram e no pior caso mostram menos; as escritas recebem um id
 * vindo do navegador e têm de ser conferidas, ou alguém grava por cima dos
 * dados de outra empresa mandando o id à mão.
 */
export async function exigirUnidade(
  supabase: Cliente,
  escopo: Escopo,
  unidadeId: string,
): Promise<void> {
  if (escopo.global) return;
  const { data, error } = await supabase
    .from("unidades")
    .select("empresa_id")
    .eq("id", unidadeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.empresa_id !== escopo.empresaId) {
    throw new Error("Esta unidade não pertence à sua empresa.");
  }
}

/** Tabelas com `empresa_id` próprio, conferíveis sem passar pela unidade. */
type TabelaComEmpresa = "ia_modelos" | "unidades";

/** Confirma que a linha é da empresa ao alcance, pelo seu id. */
export async function exigirLinhaDaEmpresa(
  supabase: Cliente,
  escopo: Escopo,
  tabela: TabelaComEmpresa,
  id: string,
): Promise<void> {
  if (escopo.global) return;
  const { data, error } = await supabase
    .from(tabela)
    .select("empresa_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.empresa_id !== escopo.empresaId) {
    throw new Error("Este registo não pertence à sua empresa.");
  }
}

/**
 * Tabelas cujas linhas identificam a unidade numa coluna `unidade_id`.
 * Listadas à mão de propósito: assim não se passa aqui um nome de tabela vindo
 * do navegador.
 */
type TabelaComUnidade =
  | "cnaes_unidade"
  | "responsaveis_tecnicos"
  | "licencas"
  | "documentos"
  | "processos_sei"
  | "ia_modelos";

/**
 * Confirma que a linha pertence a uma unidade ao alcance, pelo seu id.
 *
 * É o que impede que alguém apague o CNAE ou o responsável técnico de outra
 * empresa mandando o id à mão: o `.eq("id", ...)` sozinho apagaria, porque o id
 * é tudo o que a consulta pede.
 */
export async function exigirLinhaDaUnidade(
  supabase: Cliente,
  escopo: Escopo,
  tabela: TabelaComUnidade,
  id: string,
): Promise<void> {
  if (escopo.global) return;
  const { data, error } = await supabase
    .from(tabela)
    .select("unidade_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.unidade_id) throw new Error("Registo não encontrado.");
  await exigirUnidade(supabase, escopo, data.unidade_id);
}

/** Como `exigirUnidade`, mas partindo da licença. */
export async function exigirLicenca(
  supabase: Cliente,
  escopo: Escopo,
  licencaId: string,
): Promise<void> {
  if (escopo.global) return;
  const { data, error } = await supabase
    .from("licencas")
    .select("unidade_id")
    .eq("id", licencaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.unidade_id) throw new Error("Licença não encontrada.");
  await exigirUnidade(supabase, escopo, data.unidade_id);
}

/** Tabelas cujas linhas identificam a licença numa coluna `licenca_id`. */
type TabelaComLicenca = "checklist_itens" | "notificacoes_vencimento";

/** Confirma que a linha pertence a uma licença ao alcance, pelo seu id. */
export async function exigirLinhaDaLicenca(
  supabase: Cliente,
  escopo: Escopo,
  tabela: TabelaComLicenca,
  id: string,
): Promise<void> {
  if (escopo.global) return;
  const { data, error } = await supabase
    .from(tabela)
    .select("licenca_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.licenca_id) throw new Error("Registo não encontrado.");
  await exigirLicenca(supabase, escopo, data.licenca_id);
}

/** Como `exigirUnidade`, mas partindo do processo SEI. */
export async function exigirProcesso(
  supabase: Cliente,
  escopo: Escopo,
  processoId: string,
): Promise<void> {
  if (escopo.global) return;
  const { data, error } = await supabase
    .from("processos_sei")
    .select("unidade_id")
    .eq("id", processoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.unidade_id) throw new Error("Processo não encontrado.");
  await exigirUnidade(supabase, escopo, data.unidade_id);
}

/** Confirma que o item pertence a um processo ao alcance, pelo seu id. */
export async function exigirItemDoProcesso(
  supabase: Cliente,
  escopo: Escopo,
  id: string,
): Promise<void> {
  if (escopo.global) return;
  const { data, error } = await supabase
    .from("processo_itens")
    .select("processo_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.processo_id) throw new Error("Item não encontrado.");
  await exigirProcesso(supabase, escopo, data.processo_id);
}

/** Como `exigirUnidade`, mas partindo do documento. */
export async function exigirDocumento(
  supabase: Cliente,
  escopo: Escopo,
  documentoId: string,
): Promise<void> {
  if (escopo.global) return;
  const { data, error } = await supabase
    .from("documentos")
    .select("unidade_id, licenca_id")
    .eq("id", documentoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Documento não encontrado.");
  if (data.unidade_id) return exigirUnidade(supabase, escopo, data.unidade_id);
  if (data.licenca_id) return exigirLicenca(supabase, escopo, data.licenca_id);
  // Um documento sem unidade nem licença não tem dono identificável. Recusa-se:
  // deixá-lo passar era abrir uma porta que não se sabe para onde dá.
  throw new Error("Documento sem unidade nem licença associada.");
}
