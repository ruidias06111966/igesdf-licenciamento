import { createServerFn } from "@tanstack/react-start";
import { requireAcesso } from "@/lib/acesso-middleware";
import { z } from "zod";
import { vaziosParaNulo } from "@/lib/sanitize";

const normativaSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum([
    "rdc",
    "portaria",
    "normativa",
    "instrucao_normativa",
    "lei",
    "decreto",
    "resolucao",
    "processo_sei",
    "outro",
  ]),
  numero: z.string().trim().min(1).max(60),
  ano: z.number().int().min(1900).max(2100).nullable().optional(),
  orgao_sigla: z.string().trim().min(2).max(40),
  titulo: z.string().trim().min(3).max(300),
  ementa: z.string().trim().max(4000).nullable().optional(),
  ambito: z.enum(["federal", "distrital", "interno"]),
  aplicacao: z.array(z.string().max(40)).default([]),
  data_publicacao: z.string().nullable().optional(),
  situacao: z.enum(["vigente", "revogada", "substituida", "em_consulta"]),
  link: z.string().trim().max(500).nullable().optional(),
  storage_path: z.string().trim().max(500).nullable().optional(),
  tags: z.array(z.string().max(40)).default([]),
  principal: z.boolean().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export const listNormativas = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("normativas")
      .select("*")
      .order("principal", { ascending: false })
      .order("ano", { ascending: false, nullsFirst: false })
      .order("numero");
    if (error) throw error;
    return data ?? [];
  });

export const upsertNormativa = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => normativaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    if (data.id) {
      const { error } = await context.supabase.from("normativas").update(clean).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    delete clean.id;
    const { data: ins, error } = await context.supabase
      .from("normativas")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteNormativa = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), storage_path: z.string().nullable().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.storage_path)
      await context.supabase.storage.from("licencas-docs").remove([data.storage_path]);
    const { error } = await context.supabase.from("normativas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
