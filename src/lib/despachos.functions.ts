import { createServerFn } from "@tanstack/react-start";
import { requireMaster } from "@/lib/acesso-middleware";

export const dadosDespachoUnidade = createServerFn({ method: "POST" })
  .middleware([requireMaster])
  .inputValidator((entrada: { unidade_id: string }) => entrada)
  .handler(async ({ data, context }) => {
    const id = String(data?.unidade_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unidade inválida.");
    const supabase = context.supabase;

    const [unidade, cnaes, licencas, processos] = await Promise.all([
      supabase.from("unidades").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("cnaes_unidade")
        .select("codigo, descricao, status, data_vencimento")
        .eq("unidade_id", id)
        .order("codigo"),
      supabase
        .from("licencas")
        .select(
          "id, orgao, descricao, numero, processo_sei, status, data_vencimento, data_emissao, observacoes, updated_at",
        )
        .eq("unidade_id", id)
        .order("orgao"),
      supabase
        .from("processos_sei")
        .select("id, numero, assunto, orgao, situacao, data_abertura")
        .eq("unidade_id", id)
        .eq("ativo", true)
        .order("data_abertura", { ascending: false }),
    ]);

    if (unidade.error) throw unidade.error;
    if (!unidade.data) throw new Error("Unidade não encontrada.");
    if (cnaes.error) throw cnaes.error;
    if (licencas.error) throw licencas.error;
    if (processos.error) throw processos.error;

    return {
      unidade: unidade.data,
      cnaes: cnaes.data ?? [],
      licencas: licencas.data ?? [],
      processos: processos.data ?? [],
    };
  });

export const dadosConsolidado = createServerFn({ method: "POST" })
  .middleware([requireMaster])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    const unidades = await supabase
      .from("unidades")
      .select(
        "id, nome, nome_fantasia, tipo, cnpj, regiao_administrativa, ativa, situacao_edificacao",
      )
      .eq("ativa", true)
      .order("nome");
    if (unidades.error) throw unidades.error;

    // Paginação explícita: a base já passa das mil licenças e o PostgREST
    // corta silenciosamente no limite por omissão.
    const licencas: {
      id: string;
      unidade_id: string;
      orgao: string;
      descricao: string | null;
      status: string;
      data_vencimento: string | null;
      updated_at: string;
    }[] = [];
    const passo = 1000;
    for (let inicio = 0; ; inicio += passo) {
      const pagina = await supabase
        .from("licencas")
        .select("id, unidade_id, orgao, descricao, status, data_vencimento, updated_at")
        .order("id")
        .range(inicio, inicio + passo - 1);
      if (pagina.error) throw pagina.error;
      const linhas = pagina.data ?? [];
      licencas.push(...linhas);
      if (linhas.length < passo) break;
    }

    return { unidades: unidades.data ?? [], licencas };
  });

/**
 * Regista no histórico que um despacho ou consolidado foi gerado.
 *
 * Fica na auditoria com a unidade, a competência e a data, para depois se
 * conseguir dizer quem emitiu o quê e quando.
 */
export const registarDespachoGerado = createServerFn({ method: "POST" })
  .middleware([requireMaster])
  .inputValidator(
    (entrada: {
      tipo: "despacho" | "consolidado";
      unidade_id?: string | null;
      unidade?: string | null;
      competencia?: string | null;
      periodo?: string | null;
      unidades?: number | null;
      numero?: string | null;
      processo_sei?: string | null;
    }) => entrada,
  )
  .handler(async ({ data, context }) => {
    const { registarAuditoria } = await import("@/lib/auditoria.server");
    await registarAuditoria(context.supabase, {
      entidade: data.tipo === "consolidado" ? "consolidado" : "despachos",
      entidade_id: data.unidade_id ?? null,
      acao: "gerar",
      detalhes: {
        unidade: data.unidade ?? null,
        competencia: data.competencia ?? null,
        periodo: data.periodo ?? null,
        unidades: data.unidades ?? null,
        numero: data.numero ?? null,
        processo_sei: data.processo_sei ?? null,
      },
    });
    return { ok: true };
  });
