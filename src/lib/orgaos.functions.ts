import { createServerFn } from "@tanstack/react-start";
import { requireAcesso, requireEdicao } from "@/lib/acesso-middleware";
import { idSchema, orgaoSchema } from "@/lib/orgaos-schema";
import { vaziosParaNulo } from "@/lib/sanitize";

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
  .validator((input: unknown) => orgaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    // A validação é repetida aqui porque o compilador remove o validador do
    // módulo de servidor dividido; sem isto o handler receberia dados crus.
    const valores = orgaoSchema.parse(data);
    const clean = vaziosParaNulo(valores);
    if (valores.id) {
      const { error } = await context.supabase.from("orgaos").update(clean).eq("id", valores.id);
      if (error) throw error;
      return { id: valores.id };
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
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id } = idSchema.parse(data);
    const { error } = await context.supabase.from("orgaos").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  });
