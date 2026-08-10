/**
 * Apoio ao assistente de IA: ações permitidas, remoção de dados pessoais do
 * contexto e controlo de utilização.
 *
 * Tudo aqui é servidor-only (`*.server.ts` nunca entra no pacote do navegador).
 * A chave da Anthropic nunca passa por este ficheiro nem pelo cliente: é lida
 * apenas dentro do handler de `src/routes/api/ia.ts`.
 */

/** Ações estruturadas aceites pelo endpoint. Qualquer outra é rejeitada. */
export const ACOES = {
  resumo_unidade: "Resume a situação de licenciamento da unidade indicada no contexto.",
  priorizar_pendencias:
    "Ordena as pendências do contexto por criticidade e prazo, explicando o critério de cada posição.",
  explicar_exigencia:
    "Explica em linguagem simples a exigência do órgão indicada, e o que é preciso para a cumprir.",
  pergunta_livre: "Responde à pergunta do utilizador com base exclusiva nos dados do contexto.",
} as const;

export type Acao = keyof typeof ACOES;

export function acaoValida(valor: unknown): valor is Acao {
  return typeof valor === "string" && valor in ACOES;
}

/** Tamanho máximo do corpo do pedido, em caracteres. */
export const LIMITE_CARACTERES = 20_000;

/** Consultas por hora permitidas ao assistente. */
export const LIMITE_HORA = 30;

/**
 * Contexto de domínio enviado no campo `system`, para a IA responder com as
 * regras reais do sistema e não inventar dados.
 */
export const CONTEXTO_DOMINIO = `Você é assistente do controle de licenciamentos e alvarás do IGESDF, que abrange 19 unidades (hospitais e UPAs do Distrito Federal).
Órgãos fiscalizadores acompanhados: CBMDF, DF LEGAL, IBRAM, Polícia Civil DF, SEAGRI, SEEDF, SUSDEC e VISADF.
Regra do semáforo de vencimento: até 60 dias = crítico; de 61 a 90 dias = a vencer; acima de 90 dias = dentro do prazo; data ultrapassada = vencido.
Estados possíveis de um processo: finalizado, em estudo, aguardando órgão, vencido, dentro do prazo.
Responda em português do Brasil, de forma objetiva e técnica.
Baseie-se exclusivamente nos dados do contexto fornecido.
Se a informação não estiver no contexto, diga que não consta no sistema — nunca invente número de processo, data de validade ou situação.
Os dados do contexto vêm da base do sistema no momento da pergunta. Campos de pessoas físicas (nome de responsável técnico, CPF, e-mail, telefone) são removidos antes de chegarem a você: se perguntarem por eles, explique que o sistema não os envia ao assistente e que devem ser consultados na ficha da unidade.
Quando listar licenças ou prazos, cite sempre a unidade, o órgão e a data, para a resposta ser verificável no sistema.
Se uma lista vier truncada (indicado no campo "nota" do contexto), avise que há mais registos e sugira consultar a unidade específica.`;

/**
 * Campos que identificam pessoas físicas e nunca são enviados à Anthropic.
 * A filtragem é feita aqui, no servidor: o que o navegador manda não é de
 * confiança, e um contexto montado a partir de tabelas como
 * `responsaveis_tecnicos` traz CPF, e-mail e telefone sem se dar por isso.
 */
const CAMPOS_PESSOAIS =
  /(cpf|rg\b|nome_?completo|nome_?civil|responsavel|respons[áa]vel|contato|contacto|e-?mail|email|telefone|celular|whatsapp|assinante|servidor|matricula|matr[íi]cula|conselho|numero_?registro)/i;

const PADROES_PESSOAIS: Array<[RegExp, string]> = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[removido]"], // CPF
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[removido]"], // e-mail
  [/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[removido]"], // telefone
];

function limparTexto(valor: string): string {
  let saida = valor;
  for (const [padrao, troca] of PADROES_PESSOAIS) saida = saida.replace(padrao, troca);
  return saida;
}

/**
 * Remove do contexto qualquer campo de pessoa física e mascara CPF, e-mail e
 * telefone que apareçam no meio de textos livres. Mantém os dados
 * institucionais: unidade, órgão, tipo e número de processo, datas e situação.
 */
export function sanitizarContexto(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 12) return null;
  if (valor === null || valor === undefined) return valor;
  if (typeof valor === "string") return limparTexto(valor);
  if (typeof valor === "number" || typeof valor === "boolean") return valor;
  if (Array.isArray(valor)) return valor.map((v) => sanitizarContexto(v, profundidade + 1));
  if (typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (CAMPOS_PESSOAIS.test(chave)) continue;
      saida[chave] = sanitizarContexto(v, profundidade + 1);
    }
    return saida;
  }
  return null;
}

/** Verdadeiro quando já foram feitas `LIMITE_HORA` consultas na última hora. */
export async function limiteAtingido(): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const desde = new Date(Date.now() - 3_600_000).toISOString();
    const { count, error } = await supabaseAdmin
      .from("ia_uso")
      .select("id", { count: "exact", head: true })
      .gte("criado_em", desde);
    if (error) {
      console.error("[ia] falha ao contar utilização:", error);
      return false; // não bloqueia o utilizador por falha de infraestrutura
    }
    return (count ?? 0) >= LIMITE_HORA;
  } catch (erro) {
    console.error("[ia] falha ao contar utilização:", erro);
    return false;
  }
}

/** Regista o consumo de uma chamada, para medir custo e aplicar o limite. */
export async function registarUso(dados: {
  perfil: string;
  acao: string;
  tokensEntrada: number;
  tokensSaida: number;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ia_uso").insert({
      perfil: dados.perfil,
      acao: dados.acao,
      tokens_entrada: dados.tokensEntrada,
      tokens_saida: dados.tokensSaida,
    });
    if (error) console.error("[ia] falha ao registar utilização:", error);
  } catch (erro) {
    console.error("[ia] falha ao registar utilização:", erro);
  }
}
