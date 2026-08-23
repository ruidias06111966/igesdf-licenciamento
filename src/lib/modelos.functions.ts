import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireEdicao } from "@/lib/acesso-middleware";
import { modeloSchema } from "@/lib/modelos-schema";

/**
 * Biblioteca de documentos padrão gerados pelo assistente de IA
 * (despachos, ofícios, relatórios, checklists) para reutilização posterior.
 *
 * Cada modelo é classificado por órgão e tipo de unidade — é assim que se
 * chega depressa ao modelo certo — e guarda o histórico de versões: gravar por
 * cima arquiva a versão anterior em vez de a perder.
 */


export const listModelos = createServerFn({ method: "GET" })
  .middleware([requireEdicao])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ia_modelos")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const listVersoesModelo = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => z.object({ modelo_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: linhas, error } = await context.supabase
      .from("ia_modelo_versoes")
      .select("id, versao, titulo, conteudo, comentario, perfil, created_at")
      .eq("modelo_id", data.modelo_id)
      .order("versao", { ascending: false });
    if (error) throw error;
    return linhas ?? [];
  });

/** Repõe o conteúdo de uma versão antiga, arquivando a versão atual. */
export const restaurarVersaoModelo = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) =>
    z.object({ modelo_id: z.string().uuid(), versao_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ data: modelo }, { data: versao }] = await Promise.all([
      context.supabase.from("ia_modelos").select("*").eq("id", data.modelo_id).maybeSingle(),
      context.supabase
        .from("ia_modelo_versoes")
        .select("*")
        .eq("id", data.versao_id)
        .maybeSingle(),
    ]);
    if (!modelo) throw new Error("Modelo não encontrado.");
    if (!versao || versao.modelo_id !== data.modelo_id) throw new Error("Versão não encontrada.");

    await arquivarVersao(context.supabase, modelo, "Substituída ao repor versão anterior");
    const { error } = await context.supabase
      .from("ia_modelos")
      .update({
        titulo: versao.titulo,
        conteudo: versao.conteudo,
        versao: (modelo.versao ?? 1) + 1,
      })
      .eq("id", data.modelo_id);
    if (error) throw error;
    return { ok: true };
  });

type ClienteSupabase = SupabaseClient<Database>;

/** Arquiva o estado atual do modelo antes de ser substituído. */
async function arquivarVersao(
  supabase: ClienteSupabase,
  modelo: { id: string; versao: number | null; titulo: string; conteudo: string },
  comentario: string | null,
) {
  const { autorAtual } = await import("@/lib/acesso.server");
  await supabase.from("ia_modelo_versoes").insert({
    modelo_id: modelo.id,
    versao: modelo.versao ?? 1,
    titulo: modelo.titulo,
    conteudo: modelo.conteudo,
    comentario,
    perfil: await autorAtual(),
  });
}


export const upsertModelo = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => modeloSchema.parse(input))
  .handler(async ({ data, context }) => {
    const registo = {
      titulo: data.titulo,
      tipo: data.tipo,
      conteudo: data.conteudo,
      tags: data.tags,
      orgao: data.orgao || null,
      tipo_unidade: data.tipo_unidade || null,
      unidade_id: data.unidade_id || null,
      processo_id: data.processo_id || null,
      observacoes: data.observacoes || null,
    };
    if (data.id) {
      const { data: atual } = await context.supabase
        .from("ia_modelos")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (atual) {
        // Gravar por cima nunca apaga: a versão anterior fica arquivada.
        await arquivarVersao(
          context.supabase as unknown as ClienteSupabase,
          atual,
          data.comentario_versao ?? null,
        );
      }
      const { error } = await context.supabase
        .from("ia_modelos")
        .update({ ...registo, versao: (atual?.versao ?? 1) + 1 })
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("ia_modelos")
      .insert(registo)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteModelo = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ia_modelos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });


/** Nome de ficheiro seguro a partir do título do modelo. */
function slug(titulo: string) {
  return (
    titulo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "documento"
  );
}

/**
 * Arquiva o modelo como documento da unidade ou do processo SEI, para ficar
 * junto dos restantes anexos do licenciamento.
 */
export const anexarModelo = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        unidade_id: z.string().uuid().nullable().optional(),
        processo_id: z.string().uuid().nullable().optional(),
      })
      .refine((v) => Boolean(v.unidade_id || v.processo_id), {
        message: "Escolha uma unidade ou um processo para anexar o documento.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: modelo, error: erroModelo } = await context.supabase
      .from("ia_modelos")
      .select("*")
      .eq("id", data.id)
      .single();
    if (erroModelo) throw erroModelo;

    const caminho = `modelos-ia/${data.id}/${Date.now()}-${slug(modelo.titulo)}.md`;
    const { error: erroUpload } = await context.supabase.storage
      .from("licencas-docs")
      .upload(caminho, new Blob([modelo.conteudo], { type: "text/markdown" }), {
        contentType: "text/markdown; charset=utf-8",
        upsert: false,
      });
    if (erroUpload) throw erroUpload;

    const { error } = await context.supabase.from("documentos").insert({
      nome: `${modelo.titulo}.md`,
      descricao: `Documento gerado pelo assistente de IA (${modelo.tipo}).`,
      categoria: "modelo_ia",
      storage_path: caminho,
      mime_type: "text/markdown",
      tamanho_bytes: new TextEncoder().encode(modelo.conteudo).length,
      unidade_id: data.unidade_id || null,
      processo_id: data.processo_id || null,
    });
    if (error) throw error;
    return { ok: true, storage_path: caminho };
  });
