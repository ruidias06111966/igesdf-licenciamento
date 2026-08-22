import { createFileRoute } from "@tanstack/react-router";

type EnvioEmail = (
  payload: { apiKey: string; from: string; to: string; subject: string; html: string },
  opcoes: Record<string, unknown>,
) => Promise<unknown>;

type EmailModule = {
  sendLovableEmail?: EnvioEmail;
  default?: EnvioEmail & { sendLovableEmail?: EnvioEmail };
};

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Envia notificações de vencimento a 90/60/30/15 dias.
// Cron externo chama esta rota diariamente (ver Cloud > Jobs).
// Segurança: apikey do projeto (obrigatória).
export const Route = createFileRoute("/api/public/hooks/enviar-alertas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected = process.env.ALERTAS_CRON_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        // Aceita vários destinatários separados por vírgula ou ponto e vírgula.
        const destinatarios = (process.env.ALERTAS_EMAIL_DESTINATARIO ?? "")
          .split(/[,;]/)
          .map((e) => e.trim())
          .filter((e) => e.includes("@"));
        if (destinatarios.length === 0) {
          return Response.json(
            { ok: false, reason: "ALERTAS_EMAIL_DESTINATARIO não configurado" },
            { status: 200 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { orgaoLabel } = await import("@/lib/domain");
        const alvos = [15, 30, 60, 90];
        const enviados: { licenca: string; dias: number; destinatarios: number }[] = [];

        // Antes de avisar, põe as situações em dia: uma licença cujo prazo já
        // passou passa a constar como vencida, sem depender de edição manual.
        const { error: erroSync } = await supabaseAdmin.rpc("sincronizar_licencas_vencidas", {
          _origem: "automatico",
        });
        if (erroSync) console.error("[alertas] sincronização de vencidas falhou:", erroSync);

        // Responsáveis técnicos ativos com e-mail: o aviso tem de chegar a quem
        // trata da renovação na unidade, não só à caixa central.
        const { data: rts } = await supabaseAdmin
          .from("responsaveis_tecnicos")
          .select("unidade_id, nome, email, ativo")
          .eq("ativo", true);
        const contactosPorUnidade = new Map<string, string[]>();
        for (const rt of rts ?? []) {
          if (!rt.unidade_id || !rt.email?.includes("@")) continue;
          const lista = contactosPorUnidade.get(rt.unidade_id) ?? [];
          lista.push(rt.email.trim());
          contactosPorUnidade.set(rt.unidade_id, lista);
        }

        const mod = (await import("@lovable.dev/email-js")) as unknown as EmailModule;
        const send = mod.sendLovableEmail ?? mod.default?.sendLovableEmail ?? mod.default;

        type LicencaAlerta = {
          id: string;
          orgao: string;
          data_vencimento: string | null;
          unidade_id: string | null;
          unidades: { nome: string | null } | null;
        };

        async function notificar(l: LicencaAlerta, dias: number, vencida: boolean) {
          // Anti-duplicação por (licença, escalão de dias). O aviso de licença
          // já vencida usa o escalão 0.
          const { data: existe } = await supabaseAdmin
            .from("notificacoes_vencimento")
            .select("id")
            .eq("licenca_id", l.id)
            .eq("dias_antes", dias)
            .maybeSingle();
          if (existe) return;

          const nomeUnidade = l.unidades?.nome ?? "—";
          const orgao = orgaoLabel(l.orgao as never);
          const iso = l.data_vencimento ?? "—";
          const assunto = vencida
            ? `[IGESDF - Licenciamento] Licença ${orgao} — ${nomeUnidade} está VENCIDA`
            : `[IGESDF - Licenciamento] Licença ${orgao} — ${nomeUnidade} vence em ${dias} dias`;

          const cor = vencida ? "#dc2626" : "#0ea5b7";
          const chamada = vencida
            ? `Esta licença consta como <strong>vencida</strong> desde ${escaparHtml(iso)}.`
            : `A licença abaixo vence em <strong>${dias} dias</strong> (${escaparHtml(iso)}).`;
          // O nome da unidade vem do cadastro, então é escapado antes de entrar no HTML.
          const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:600px">
              <h2 style="color:${cor}">${vencida ? "Licença vencida" : "Alerta de vencimento"}</h2>
              <p>${chamada}</p>
              <table style="border-collapse:collapse;margin-top:12px">
                <tr><td style="padding:6px 12px;color:#64748b">Unidade</td><td style="padding:6px 12px"><strong>${escaparHtml(nomeUnidade)}</strong></td></tr>
                <tr><td style="padding:6px 12px;color:#64748b">Órgão</td><td style="padding:6px 12px">${escaparHtml(orgao)}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748b">Vencimento</td><td style="padding:6px 12px">${escaparHtml(iso)}</td></tr>
              </table>
              <p style="margin-top:16px;color:#64748b;font-size:12px">Lembrete: a renovação da Licença Sanitária deve ser protocolada com pelo menos 60 dias de antecedência.</p>
            </div>`;

          const daUnidade = contactosPorUnidade.get(l.unidade_id ?? "") ?? [];
          const todos = [...new Set([...destinatarios, ...daUnidade])];

          try {
            if (typeof send !== "function") throw new Error("Módulo de e-mail indisponível");
            for (const to of todos) {
              await send(
                {
                  apiKey: process.env.LOVABLE_API_KEY!,
                  from: "IGESDF - Licenciamento <notify@lovable.app>",
                  to,
                  subject: assunto,
                  html,
                },
                {},
              );
            }
            await supabaseAdmin.from("notificacoes_vencimento").insert({
              licenca_id: l.id,
              dias_antes: dias,
              destinatario: todos.join(", "),
            });
            enviados.push({ licenca: l.id, dias, destinatarios: todos.length });
          } catch (erro) {
            console.error("Falha ao enviar e-mail de alerta:", erro);
          }
        }

        for (const dias of alvos) {
          const alvo = new Date();
          alvo.setDate(alvo.getDate() + dias);
          const iso = alvo.toISOString().slice(0, 10);

          // `unidades.ativa` é obrigatório: esta consulta usa a service role, que
          // ignora RLS, e sem o filtro continuaria a alertar sobre unidades
          // removidas do cadastro.
          const { data: licencas } = await supabaseAdmin
            .from("licencas")
            .select("id, orgao, data_vencimento, unidade_id, unidades!inner(nome, ativa)")
            .eq("data_vencimento", iso)
            .eq("unidades.ativa", true)
            .in("status", ["vigente", "a_vencer", "em_analise", "aguardando_orgao"]);

          for (const l of licencas ?? []) await notificar(l as LicencaAlerta, dias, false);
        }

        // Segundo aviso: licenças que a rotina acabou de marcar como vencidas.
        const hoje = new Date().toISOString().slice(0, 10);
        const limite = new Date();
        limite.setDate(limite.getDate() - 45);
        const { data: vencidas } = await supabaseAdmin
          .from("licencas")
          .select("id, orgao, data_vencimento, unidade_id, unidades!inner(nome, ativa)")
          .eq("status", "vencida")
          .eq("unidades.ativa", true)
          .gte("data_vencimento", limite.toISOString().slice(0, 10))
          .lte("data_vencimento", hoje);

        for (const l of vencidas ?? []) await notificar(l as LicencaAlerta, 0, true);

        return Response.json({ ok: true, enviados });
      },
    },
  },
});
