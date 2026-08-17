import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { exigirAutorizacao } from "../auth";
import { db, texto } from "../db";

export default defineTool({
  name: "listar_normativas",
  title: "Listar normativas",
  description:
    "Consulta as portarias, RDCs e normativas de licenciamento registadas, com órgão emissor, ementa e link oficial.",
  inputSchema: {
    procura: z.string().optional().describe("Texto a procurar no título, número ou ementa."),
    orgao: z.string().optional().describe("Sigla do órgão emissor, ex.: ANVISA, VISADF."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ procura, orgao }, ctx) => {
    exigirAutorizacao(ctx);
    const supabase = await db();
    let q = supabase
      .from("normativas")
      .select("id, tipo, numero, ano, titulo, ementa, orgao_sigla, ambito, situacao, link")
      .order("ano", { ascending: false, nullsFirst: false })
      .limit(200);
    if (orgao) q = q.ilike("orgao_sigla", `%${orgao}%`);
    if (procura) {
      // O texto vai para dentro da sintaxe de filtro do PostgREST; vírgulas,
      // parênteses e aspas mudariam a lógica da consulta. Escapamos os
      // curingas e envolvemos o valor em aspas para o tratar como texto puro.
      const termo = procura.trim().slice(0, 200).replace(/[\\"]/g, "\\$&").replace(/[(),]/g, " ");
      if (termo)
        q = q.or(`titulo.ilike."%${termo}%",ementa.ilike."%${termo}%",numero.ilike."%${termo}%"`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: texto(data ?? []) }],
      structuredContent: { normativas: data ?? [] },
    };
  },
});
