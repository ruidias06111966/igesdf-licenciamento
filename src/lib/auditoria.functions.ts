import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAcesso } from "@/lib/acesso-middleware";

const filtroSchema = z.object({
  entidade: z.string().trim().max(40).optional(),
  entidade_id: z.string().uuid().optional(),
  acao: z.string().trim().max(40).optional(),
  de: z.string().trim().max(10).optional(),
  ate: z.string().trim().max(10).optional(),
  limite: z.number().int().min(1).max(1000).default(300),
});

export type RegistoAuditoria = {
  id: string;
  created_at: string;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  perfil: string | null;
  alteracoes: { campo: string; antes: unknown; depois: unknown }[];
  detalhes: Record<string, unknown> | null;
};

export const listAuditoria = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => filtroSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("atividade_log")
      .select("id, created_at, entidade, entidade_id, acao, perfil, alteracoes, detalhes")
      .order("created_at", { ascending: false })
      .limit(data.limite);

    if (data.entidade) q = q.eq("entidade", data.entidade);
    if (data.entidade_id) q = q.eq("entidade_id", data.entidade_id);
    if (data.acao) q = q.eq("acao", data.acao);
    if (data.de) q = q.gte("created_at", `${data.de}T00:00:00Z`);
    if (data.ate) q = q.lte("created_at", `${data.ate}T23:59:59Z`);

    const { data: linhas, error } = await q;
    if (error) throw error;
    return (linhas ?? []).map((l) => ({
      ...l,
      alteracoes: Array.isArray(l.alteracoes)
        ? (l.alteracoes as RegistoAuditoria["alteracoes"])
        : [],
      detalhes: (l.detalhes ?? null) as RegistoAuditoria["detalhes"],
    })) as RegistoAuditoria[];
  });
