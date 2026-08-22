import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAcesso, requireEdicao } from "@/lib/acesso-middleware";

/**
 * Correção automática diária: leitura da configuração, gravação do horário e
 * execução manual em lote.
 *
 * O agendamento vive no `pg_cron`, que corre sempre em UTC. Aqui guarda-se a
 * hora local e o fuso escolhidos pelo utilizador; a conversão para UTC e o
 * reagendamento são feitos pela função `agendar_sincronizacao` no banco.
 */

const configSchema = z.object({
  hora: z.number().int().min(0).max(23),
  minuto: z.number().int().min(0).max(59),
  fuso: z.string().trim().min(3).max(60),
  ativo: z.boolean(),
});

export type ConfigRotina = z.infer<typeof configSchema> & {
  ultima_execucao: string | null;
  ultimo_total: number | null;
  expressao: string | null;
};

export const getConfigRotina = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .handler(async ({ context }): Promise<ConfigRotina> => {
    const { data, error } = await context.supabase
      .from("config_rotina")
      .select("hora, minuto, fuso, ativo, ultima_execucao, ultimo_total")
      .eq("id", "sincronizacao")
      .maybeSingle();
    if (error) throw error;
    return {
      hora: data?.hora ?? 0,
      minuto: data?.minuto ?? 10,
      fuso: data?.fuso ?? "America/Sao_Paulo",
      ativo: data?.ativo ?? true,
      ultima_execucao: data?.ultima_execucao ?? null,
      ultimo_total: data?.ultimo_total ?? null,
      expressao: null,
    };
  });

export const salvarConfigRotina = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => configSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("config_rotina")
      .upsert({ id: "sincronizacao", ...data, updated_at: new Date().toISOString() });
    if (error) throw error;

    // Reagenda o cron com o novo horário convertido para UTC.
    const { data: expressao, error: erroCron } = await context.supabase.rpc(
      "agendar_sincronizacao",
    );
    if (erroCron) throw erroCron;

    const { registarAuditoria } = await import("@/lib/auditoria.server");
    await registarAuditoria(context.supabase, {
      entidade: "rotina",
      acao: "atualizar",
      alteracoes: [
        {
          campo: "horario_rotina",
          antes: null,
          depois: `${String(data.hora).padStart(2, "0")}:${String(data.minuto).padStart(2, "0")} ${data.fuso}${data.ativo ? "" : " (desativado)"}`,
        },
      ],
      detalhes: { expressao_cron: expressao ?? "—" },
    });

    return { ok: true, expressao: expressao ?? null };
  });

export const executarSincronizacao = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("sincronizar_licencas_vencidas", {
      _origem: "manual",
    });
    if (error) throw error;
    return { atualizadas: data ?? 0 };
  });
