import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireEdicao } from "@/lib/acesso-middleware";

/**
 * Biblioteca de documentos padrão gerados pelo assistente de IA
 * (despachos, ofícios, relatórios, checklists) para reutilização posterior.
 */
const TIPOS = [
  "despacho",
  "oficio",
  "relatorio",
  "memorando",
  "checklist",
  "parecer",
  "outro",
] as const;

const modeloSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(3).max(200),
  tipo: z.enum(TIPOS),
  conteudo: z.string().trim().min(1).max(200_000),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  unidade_id: z.string().uuid().nullable().optional(),
  processo_id: z.string().uuid().nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

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

export const upsertModelo = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => modeloSchema.parse(input))
  .handler(async ({ data, context }) => {
    const registo = {
      titulo: data.titulo,
      tipo: data.tipo,
      conteudo: data.conteudo,
      tags: data.tags,
      unidade_id: data.unidade_id || null,
      processo_id: data.processo_id || null,
      observacoes: data.observacoes || null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("ia_modelos")
        .update(registo)
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