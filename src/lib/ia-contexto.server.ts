/**
 * Monta o retrato do sistema que acompanha cada pergunta ao assistente.
 *
 * O contexto é construído aqui, no servidor, e não enviado pelo navegador. Isso
 * evita despachar centenas de registos a cada mensagem, garante que os dados
 * estão frescos, e — mais importante — impede que o cliente escolha o que a IA
 * vê. Antes o campo `contexto` existia no endpoint mas ninguém o preenchia: o
 * assistente respondia sempre "não consta no sistema" a qualquer pergunta sobre
 * unidades ou licenças reais.
 *
 * Tudo o que sai daqui passa ainda por `sanitizarContexto`, que remove CPF,
 * e-mail, telefone e nomes de pessoas antes de a informação deixar o servidor.
 */

/** Tectos por lista, para o contexto não crescer sem limite com a rede toda. */
const MAX_LINHAS = 120;
const MAX_UNIDADES = 40;

type Semaforo = string | null;

function contar(valores: Semaforo[]): Record<string, number> {
  const saida: Record<string, number> = {};
  for (const v of valores) {
    const chave = v ?? "sem_data";
    saida[chave] = (saida[chave] ?? 0) + 1;
  }
  return saida;
}

/**
 * Retrato da rede: indicadores, o que está vencido ou em prazo crítico, e os
 * processos ainda abertos. Responde à maioria das perguntas de gestão sem
 * precisar de despejar a base inteira.
 */
async function contextoRede() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [licencas, unidades, processos] = await Promise.all([
    supabaseAdmin
      .from("v_licencas_dashboard")
      .select(
        "unidade_nome, orgao, descricao, status, semaforo, data_vencimento, dias_restantes, numero, processo_sei",
      )
      .order("data_vencimento", { ascending: true, nullsFirst: false }),
    supabaseAdmin
      .from("unidades")
      .select("nome, tipo, regiao_administrativa, situacao_edificacao, cnpj")
      .eq("ativa", true)
      .order("nome"),
    supabaseAdmin
      .from("processos_sei")
      .select("numero, assunto, tipo, orgao, situacao, data_abertura, unidades(nome)")
      .eq("ativo", true)
      .neq("situacao", "concluido")
      .order("data_abertura", { ascending: false }),
  ]);

  const todas = licencas.data ?? [];
  const criticas = todas.filter(
    (l) => l.semaforo === "vencida" || l.semaforo === "a_vencer_critico",
  );
  const aVencer = todas.filter((l) => l.semaforo === "a_vencer_alerta");

  return {
    escopo: "rede completa",
    gerado_em: new Date().toISOString().slice(0, 10),
    indicadores: {
      unidades_ativas: (unidades.data ?? []).length,
      licencas_total: todas.length,
      por_semaforo: contar(todas.map((l) => l.semaforo)),
      processos_em_aberto: (processos.data ?? []).length,
    },
    unidades: (unidades.data ?? []).slice(0, MAX_UNIDADES),
    licencas_vencidas_ou_criticas: criticas.slice(0, MAX_LINHAS),
    licencas_a_vencer_90_dias: aVencer.slice(0, MAX_LINHAS),
    processos_em_aberto: (processos.data ?? []).slice(0, MAX_LINHAS),
    nota:
      criticas.length > MAX_LINHAS || aVencer.length > MAX_LINHAS
        ? `Listas truncadas em ${MAX_LINHAS} registos. Peça o detalhe de uma unidade específica para ver o resto.`
        : undefined,
  };
}

/** Retrato de uma unidade: licenças, CNAEs e processos. */
async function contextoUnidade(unidadeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: unidade } = await supabaseAdmin
    .from("unidades")
    .select(
      "id, nome, tipo, cnpj, cf_df, processo_sei, regiao_administrativa, situacao_edificacao, endereco, observacoes",
    )
    .eq("id", unidadeId)
    .eq("ativa", true)
    .maybeSingle();

  if (!unidade) return { escopo: "unidade", erro: "Unidade não encontrada ou desativada." };

  const [licencas, cnaes, processos] = await Promise.all([
    supabaseAdmin
      .from("v_licencas_dashboard")
      .select(
        "orgao, descricao, status, semaforo, data_emissao, data_vencimento, dias_restantes, numero, processo_sei, observacoes",
      )
      .eq("unidade_id", unidadeId)
      .order("orgao"),
    supabaseAdmin
      .from("cnaes_unidade")
      .select("codigo, descricao, status, data_vencimento")
      .eq("unidade_id", unidadeId)
      .order("codigo"),
    supabaseAdmin
      .from("processos_sei")
      .select("numero, assunto, tipo, orgao, situacao, data_abertura, data_conclusao")
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .order("data_abertura", { ascending: false }),
  ]);

  return {
    escopo: "unidade",
    gerado_em: new Date().toISOString().slice(0, 10),
    unidade,
    resumo_semaforo: contar((licencas.data ?? []).map((l) => l.semaforo)),
    licencas: (licencas.data ?? []).slice(0, MAX_LINHAS),
    cnaes: cnaes.data ?? [],
    processos: (processos.data ?? []).slice(0, MAX_LINHAS),
  };
}

/**
 * Escolhe o contexto conforme a ação pedida.
 *
 * `explicar_exigencia` fica sem dados de propósito: é uma pergunta sobre a regra
 * do órgão, não sobre o estado da rede, e mandar a base inteira só aumentaria
 * custo e exposição sem melhorar a resposta.
 */
export async function montarContexto(
  acao: string,
  unidadeId?: string | null,
): Promise<unknown | null> {
  try {
    if (acao === "explicar_exigencia") return null;
    if (unidadeId) return await contextoUnidade(unidadeId);
    return await contextoRede();
  } catch (erro) {
    console.error("[ia] falha ao montar o contexto:", erro);
    // Sem contexto a IA responde que não tem os dados — melhor do que falhar
    // o pedido inteiro por causa de uma consulta.
    return null;
  }
}
