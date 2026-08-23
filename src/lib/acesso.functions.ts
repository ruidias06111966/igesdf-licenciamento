import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMaster } from "@/lib/acesso-middleware";

/**
 * Estado da sessão: usado pelo guarda de rota e pela interface para saber se há
 * conta iniciada, se já foi autorizada pelo master e com que perfil.
 */
export const verificarAcesso = createServerFn({ method: "GET" }).handler(async () => {
  const { sessaoAtual } = await import("@/lib/acesso.server");
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { sessao: false as const, autorizado: false, perfil: null, email: null, suspenso: false };
  }
  return {
    sessao: true as const,
    autorizado: sessao.perfil !== null,
    perfil: sessao.perfil,
    email: sessao.email,
    suspenso: sessao.suspenso,
  };
});

/* ---------------------------------------------------------------------- */
/* Gestão de utilizadores — reservada ao master                            */
/* ---------------------------------------------------------------------- */

export const listarUtilizadores = createServerFn({ method: "GET" })
  .middleware([requireMaster])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("perfis_acesso")
      .select("user_id, email, nome, perfil, suspenso, autorizado_em, ultimo_acesso, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const definirSchema = z.object({
  userId: z.string().uuid(),
  perfil: z.enum(["master", "edicao", "leitura"]).nullable(),
  suspenso: z.boolean().optional(),
});

/** Atribui, altera ou retira o perfil de uma conta. */
export const definirPerfilUtilizador = createServerFn({ method: "POST" })
  .middleware([requireMaster])
  .inputValidator((input: unknown) => definirSchema.parse(input))
  .handler(async ({ data, context }) => {
    // O master não se pode remover a si próprio — ficaria um sistema sem quem
    // autorize os restantes.
    if (data.userId === context.sessao.userId && (data.perfil !== "master" || data.suspenso)) {
      throw new Error("Não é possível retirar o seu próprio acesso master.");
    }
    const { error } = await context.supabase
      .from("perfis_acesso")
      .update({
        perfil: data.perfil,
        suspenso: data.suspenso ?? false,
        autorizado_por: context.sessao.userId,
        autorizado_em: data.perfil ? new Date().toISOString() : null,
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    const { registarAuditoria } = await import("@/lib/auditoria.server");
    await registarAuditoria(context.supabase, {
      entidade: "perfis_acesso",
      entidade_id: data.userId,
      acao: data.perfil ? "autorizar" : "revogar",
      detalhes: { perfil: data.perfil, suspenso: data.suspenso ?? false },
    });
    return { ok: true };
  });
