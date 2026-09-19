import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { escopoDoMcp } from "../auth";
import { daEmpresa } from "@/lib/escopo.server";
import { db, texto } from "../db";

export default defineTool({
  name: "licencas_a_vencer",
  title: "Licenças a vencer",
  description:
    "Devolve as licenças já vencidas ou a vencer dentro de um número de dias, ordenadas pelo prazo mais próximo.",
  inputSchema: {
    dias: z.number().optional().describe("Janela em dias a partir de hoje (por omissão 90)."),
    incluir_vencidas: z
      .boolean()
      .optional()
      .describe("Incluir licenças já vencidas (sim por omissão)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ dias, incluir_vencidas }, ctx) => {
    const { escopo } = await escopoDoMcp(ctx);
    const supabase = await db();
    const janela = Math.min(Math.max(dias ?? 90, 1), 3650);
    const limite = new Date(Date.now() + janela * 86_400_000).toISOString().slice(0, 10);
    let q = daEmpresa(
      supabase
        .from("v_licencas_dashboard")
        .select(
          "id, unidade_nome, orgao, status, descricao, numero, data_vencimento, dias_restantes, semaforo",
        )
        .not("data_vencimento", "is", null)
        .lte("data_vencimento", limite)
        .order("data_vencimento", { ascending: true }),
      escopo,
    );
    if (incluir_vencidas === false) {
      q = q.gte("data_vencimento", new Date().toISOString().slice(0, 10));
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: texto(data ?? []) }],
      structuredContent: { janela_dias: janela, licencas: data ?? [] },
    };
  },
});
