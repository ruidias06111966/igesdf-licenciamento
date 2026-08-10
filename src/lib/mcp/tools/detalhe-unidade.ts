import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { exigirAutorizacao } from "../auth";
import { db, texto } from "../db";

export default defineTool({
  name: "detalhe_unidade",
  title: "Detalhe da unidade",
  description:
    "Devolve o dossiê de uma unidade: dados cadastrais, CNAEs, licenças por órgão e responsáveis técnicos.",
  inputSchema: {
    unidade_id: z.string().uuid().optional().describe("Identificador da unidade."),
    nome: z.string().optional().describe("Nome (ou parte) da unidade, se não souber o id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unidade_id, nome }, ctx) => {
    exigirAutorizacao(ctx);
    const supabase = await db();
    let id = unidade_id;
    if (!id) {
      if (!nome) {
        return {
          content: [{ type: "text", text: "Indique unidade_id ou nome." }],
          isError: true,
        };
      }
      const { data } = await supabase
        .from("unidades")
        .select("id")
        .ilike("nome", `%${nome}%`)
        .eq("ativa", true)
        .limit(1);
      id = data?.[0]?.id;
      if (!id) {
        return { content: [{ type: "text", text: "Unidade não encontrada." }], isError: true };
      }
    }
    const [uni, cnaes, licencas, rts] = await Promise.all([
      supabase.from("unidades").select("*").eq("id", id).maybeSingle(),
      supabase.from("cnaes_unidade").select("*").eq("unidade_id", id).order("codigo"),
      supabase
        .from("licencas")
        .select("id, orgao, status, descricao, numero, data_vencimento, processo_sei")
        .eq("unidade_id", id)
        .order("orgao"),
      supabase.from("responsaveis_tecnicos").select("*").eq("unidade_id", id).order("nome"),
    ]);
    if (!uni.data) {
      return { content: [{ type: "text", text: "Unidade não encontrada." }], isError: true };
    }
    const resultado = {
      unidade: uni.data,
      cnaes: cnaes.data ?? [],
      licencas: licencas.data ?? [],
      responsaveis_tecnicos: rts.data ?? [],
    };
    return {
      content: [{ type: "text", text: texto(resultado) }],
      structuredContent: resultado,
    };
  },
});
