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
        const destinatario = process.env.ALERTAS_EMAIL_DESTINATARIO;
        if (!destinatario) {
          return Response.json(
            { ok: false, reason: "ALERTAS_EMAIL_DESTINATARIO não configurado" },
            { status: 200 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { orgaoLabel } = await import("@/lib/domain");
        const alvos = [15, 30, 60, 90];
        const enviados: { licenca: string; dias: number }[] = [];

        for (const dias of alvos) {
          const alvo = new Date();
          alvo.setDate(alvo.getDate() + dias);
          const iso = alvo.toISOString().slice(0, 10);

          // `unidades.ativa` é obrigatório: esta consulta usa a service role, que
          // ignora RLS, e sem o filtro continuaria a alertar sobre unidades
          // removidas do cadastro.
          const { data: licencas } = await supabaseAdmin
            .from("licencas")
            .select(
              "id, orgao, data_vencimento, observacoes, unidade_id, unidades!inner(nome, numero_iges, ativa)",
            )
            .eq("data_vencimento", iso)
            .eq("unidades.ativa", true)
            .in("status", ["vigente", "a_vencer", "em_analise", "aguardando_orgao"]);

          for (const l of licencas ?? []) {
            // Anti-duplicação por (licenca, dias)
            const { data: existe } = await supabaseAdmin
              .from("notificacoes_vencimento")
              .select("id")
              .eq("licenca_id", l.id)
              .eq("dias_antes", dias)
              .maybeSingle();
            if (existe) continue;

            const unidade = l.unidades;
            const nomeUnidade = unidade?.nome ?? "—";
            const orgao = orgaoLabel(l.orgao);
            const subject = `[IGESDF - Licenciamento] Licença ${orgao} — ${nomeUnidade} vence em ${dias} dias`;
            // O nome da unidade vem do cadastro, então é escapado antes de entrar no HTML.
            const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:600px">
              <h2 style="color:#0ea5b7">Alerta de vencimento</h2>
              <p>A licença abaixo vence em <strong>${dias} dias</strong> (${escaparHtml(iso)}).</p>
              <table style="border-collapse:collapse;margin-top:12px">
                <tr><td style="padding:6px 12px;color:#64748b">Unidade</td><td style="padding:6px 12px"><strong>${escaparHtml(nomeUnidade)}</strong></td></tr>
                <tr><td style="padding:6px 12px;color:#64748b">Órgão</td><td style="padding:6px 12px">${escaparHtml(orgao)}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748b">Vencimento</td><td style="padding:6px 12px">${escaparHtml(iso)}</td></tr>
              </table>
              <p style="margin-top:16px;color:#64748b;font-size:12px">Lembrete: a renovação da Licença Sanitária deve ser protocolada com pelo menos 60 dias de antecedência.</p>
            </div>`;

            try {
              const mod = (await import("@lovable.dev/email-js")) as unknown as EmailModule;
              const send = mod.sendLovableEmail ?? mod.default?.sendLovableEmail ?? mod.default;
              if (typeof send !== "function") throw new Error("Módulo de e-mail indisponível");
              await send(
                {
                  apiKey: process.env.LOVABLE_API_KEY!,
                  from: "IGESDF - Licenciamento <notify@lovable.app>",
                  to: destinatario,
                  subject,
                  html,
                },
                {},
              );
              await supabaseAdmin.from("notificacoes_vencimento").insert({
                licenca_id: l.id,
                dias_antes: dias,
                destinatario,
              });
              enviados.push({ licenca: l.id, dias });
            } catch (erro) {
              console.error("Falha ao enviar e-mail de alerta:", erro);
            }
          }
        }

        return Response.json({ ok: true, enviados });
      },
    },
  },
});
