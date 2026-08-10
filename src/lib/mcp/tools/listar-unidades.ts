import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { exigirAutorizacao } from "../auth";
import { db, texto } from "../db";

export default defineTool({
  name: "listar_unidades",
  title: "Listar unidades",
  description:
    "Lista as unidades do IGESDF (hospitais, UPAs e administrativos) com CNPJ, região administrativa e tipo.",
  inputSchema: {
    tipo: z.string().optional().describe("Filtrar por tipo de unidade, ex.: hospital, upa."),
    procura: z.string().optional().describe("Texto a procurar no nome da unidade."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tipo, procura }, ctx) => {
    exigirAutorizacao(ctx);
    const supabase = await db();
    let q = supabase
      .from("unidades")
      .select("id, nome, tipo, cnpj, numero_iges, regiao_administrativa, endereco")
      .eq("ativa", true)
      .order("numero_iges", { ascending: true, nullsFirst: false });
    if (tipo) q = q.eq("tipo", tipo as never);
    if (procura) q = q.ilike("nome", `%${procura}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: texto(data ?? []) }],
      structuredContent: { unidades: data ?? [] },
    };
  },
});
