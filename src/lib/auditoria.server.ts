/**
 * Registo de auditoria: quem, quando e o que mudou.
 *
 * Fica gravado o e-mail da conta com o perfil, junto com o valor anterior e o
 * novo de cada campo que realmente mudou, e a empresa a que a ação pertence —
 * sem ela, a auditoria de uma empresa mostrava o que se passou nas outras.
 *
 * Nunca deve fazer falhar a operação principal: se o registo falhar, a licença
 * já foi gravada e não faz sentido devolver erro ao utilizador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Alteracao = { campo: string; antes: unknown; depois: unknown };

/** Campos ignorados na comparação: mudam sempre e não têm valor informativo. */
const IGNORADOS = new Set(["id", "created_at", "updated_at"]);

function iguais(a: unknown, b: unknown) {
  const na = a === "" || a === undefined ? null : a;
  const nb = b === "" || b === undefined ? null : b;
  if (na === null && nb === null) return true;
  return JSON.stringify(na) === JSON.stringify(nb);
}

/** Compara o registo anterior com o novo e devolve só o que mudou. */
export function diferencas(
  antes: Record<string, unknown> | null | undefined,
  depois: Record<string, unknown>,
): Alteracao[] {
  const saida: Alteracao[] = [];
  for (const campo of Object.keys(depois)) {
    if (IGNORADOS.has(campo)) continue;
    const anterior = antes ? antes[campo] : null;
    if (iguais(anterior, depois[campo])) continue;
    saida.push({ campo, antes: antes ? (anterior ?? null) : null, depois: depois[campo] ?? null });
  }
  return saida;
}

type Registo = {
  entidade: string;
  entidade_id?: string | null;
  acao: string;
  alteracoes?: Alteracao[];
  detalhes?: Record<string, unknown>;
};

export async function registarAuditoria(
  supabase: SupabaseClient<Database>,
  registo: Registo,
): Promise<void> {
  try {
    const { sessaoAtual } = await import("@/lib/acesso.server");
    const sessao = await sessaoAtual();
    // O master global não tem empresa, e daqui não se sabe de que empresa é a
    // linha tocada. Fica sem empresa: a auditoria de cada cliente mostra de
    // menos, nunca de mais.
    await supabase.from("atividade_log").insert({
      empresa_id: sessao?.empresaId ?? null,
      entidade: registo.entidade,
      entidade_id: registo.entidade_id ?? null,
      acao: registo.acao,
      perfil: sessao ? (sessao.perfil ? `${sessao.email} (${sessao.perfil})` : sessao.email) : null,
      alteracoes: (registo.alteracoes ??
        []) as unknown as Database["public"]["Tables"]["atividade_log"]["Insert"]["alteracoes"],
      detalhes: (registo.detalhes ??
        null) as unknown as Database["public"]["Tables"]["atividade_log"]["Insert"]["detalhes"],
    });
  } catch {
    // Auditoria é acessória: nunca derruba a gravação principal.
  }
}
