import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { exigirAutorizacao } from "../auth";
import { db, texto } from "../db";

export default defineTool({
  name: "listar_processos_sei",
  title: "Listar processos SEI",
  description:
    "Lista os processos SEI de licenciamento, com órgão, situação e — opcionalmente — os itens do checklist de documentação.",
  inputSchema: {
    unidade: z.string().optional().describe("Nome (ou parte) da unidade."),
    numero: z.string().optional().describe("Número do processo SEI."),
    incluir_itens: z
      .boolean()
      .optional()
      .describe("Incluir os itens de checklist de cada processo."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unidade, numero, incluir_itens }, ctx) => {
    exigirAutorizacao(ctx);
    const supabase = await db();
    let q = supabase
      .from("processos_sei")
      .select(
        "id, numero, tipo, assunto, orgao, situacao, responsavel, data_abertura, link, unidade_id",
      )
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (numero) q = q.ilike("numero", `%${numero}%`);
    const { data: processos, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const { data: unidades } = await supabase.from("unidades").select("id, nome");
    const nomePorId = new Map((unidades ?? []).map((u) => [u.id, u.nome]));
    let lista = (processos ?? []).map((p) => ({
      ...p,
      unidade_nome: nomePorId.get(p.unidade_id) ?? null,
    }));
    if (unidade) {
      const alvo = unidade.toLowerCase();
      lista = lista.filter((p) => (p.unidade_nome ?? "").toLowerCase().includes(alvo));
    }

    let itens: unknown[] = [];
    if (incluir_itens && lista.length > 0) {
      const { data } = await supabase
        .from("processo_itens")
        .select("processo_id, titulo, situacao, obrigatorio, responsavel, prazo, data_entrega")
        .in(
          "processo_id",
          lista.map((p) => p.id),
        )
        .order("ordem");
      itens = data ?? [];
    }
    const resultado = { processos: lista, itens };
    return { content: [{ type: "text", text: texto(resultado) }], structuredContent: resultado };
  },
});
