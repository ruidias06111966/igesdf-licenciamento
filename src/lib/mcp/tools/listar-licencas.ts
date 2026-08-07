import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { exigirAutorizacao } from "../auth";
import { db, texto } from "../db";

export default defineTool({
  name: "listar_licencas",
  title: "Listar licenças",
  description:
    "Lista licenças e alvarás com unidade, órgão licenciador, estado, prazo e dias restantes. Permite filtrar por órgão, estado e unidade.",
  inputSchema: {
    orgao: z.string().optional().describe("Sigla do órgão, ex.: VISA, CBMDF, DF_LEGAL, IBRAM."),
    status: z.string().optional().describe("Estado da licença, ex.: vigente, dispensada."),
    unidade: z.string().optional().describe("Nome (ou parte) da unidade."),
    limite: z.number().optional().describe("Número máximo de registos (por omissão 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ orgao, status, unidade, limite }, ctx) => {
    exigirAutorizacao(ctx);
    const supabase = await db();
    const max = Math.min(Math.max(limite ?? 100, 1), 500);
    let q = supabase
      .from("v_licencas_dashboard")
      .select(
        "id, unidade_nome, unidade_tipo, orgao, status, descricao, numero, data_vencimento, dias_restantes, semaforo, processo_sei",
      )
      .order("data_vencimento", { ascending: true, nullsFirst: false })
      .limit(max);
    if (orgao) q = q.eq("orgao", orgao as never);
    if (status) q = q.eq("status", status as never);
    if (unidade) q = q.ilike("unidade_nome", `%${unidade}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: texto(data ?? []) }],
      structuredContent: { licencas: data ?? [] },
    };
  },
});