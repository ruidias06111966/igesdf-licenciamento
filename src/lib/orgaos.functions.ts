import { createServerFn } from "@tanstack/react-start";
import { requireAcesso, requireEdicao } from "@/lib/acesso-middleware";
import { z } from "zod";
import { vaziosParaNulo } from "@/lib/sanitize";

const orgaoSchema = z.object({
  id: z.string().uuid().optional(),
  sigla: z.string().trim().min(2).max(30),
  nome: z.string().trim().min(2).max(300),
  categoria: z.string().trim().max(150).nullable().optional(),
  site: z.string().trim().max(300).nullable().optional(),
  telefone: z.string().trim().max(60).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  endereco: z.string().trim().max(400).nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  ativo: z.boolean().optional(),
});

export const listOrgaos = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orgaos")
      .select("*")
      .order("sigla", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const upsertOrgao = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => orgaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    if (data.id) {
      const { error } = await context.supabase.from("orgaos").update(clean).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("orgaos")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteOrgao = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("orgaos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
