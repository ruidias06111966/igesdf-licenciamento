import { createFileRoute } from "@tanstack/react-router";

// Envia notificações de vencimento a 90/60/30/15 dias.
// Cron externo chama esta rota diariamente (ver Cloud > Jobs).
// Segurança: apikey do projeto (obrigatória).
export const Route = createFileRoute("/api/public/hooks/enviar-alertas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const destinatario = process.env.ALERTAS_EMAIL_DESTINATARIO;
        if (!destinatario) {
          return Response.json({ ok: false, reason: "ALERTAS_EMAIL_DESTINATARIO não configurado" }, { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const alvos = [15, 30, 60, 90];
        const enviados: any[] = [];

        for (const dias of alvos) {
          const alvo = new Date();
          alvo.setDate(alvo.getDate() + dias);
          const iso = alvo.toISOString().slice(0, 10);

          const { data: licencas } = await supabaseAdmin
            .from("licencas")
            .select("id, orgao, data_vencimento, observacoes, unidade_id, unidades!inner(nome, numero_iges)")
            .eq("data_vencimento", iso)
            .in("status", ["vigente","a_vencer","em_analise","aguardando_orgao"]);

          for (const l of licencas ?? []) {
            // Anti-duplicação por (licenca, dias)
            const { data: existe } = await supabaseAdmin
              .from("notificacoes_vencimento")
              .select("id").eq("licenca_id", l.id).eq("dias_antes", dias).maybeSingle();
            if (existe) continue;

            const unidade = (l.unidades as any);
            const subject = `[IGESDF Compliance] Licença ${l.orgao} — ${unidade?.nome} vence em ${dias} dias`;
            const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:600px">
              <h2 style="color:#0ea5b7">Alerta de vencimento</h2>
              <p>A licença abaixo vence em <strong>${dias} dias</strong> (${iso}).</p>
              <table style="border-collapse:collapse;margin-top:12px">
                <tr><td style="padding:6px 12px;color:#64748b">Unidade</td><td style="padding:6px 12px"><strong>${unidade?.nome ?? "—"}</strong></td></tr>
                <tr><td style="padding:6px 12px;color:#64748b">Órgão</td><td style="padding:6px 12px">${l.orgao}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748b">Vencimento</td><td style="padding:6px 12px">${iso}</td></tr>
              </table>
              <p style="margin-top:16px;color:#64748b;font-size:12px">Lembrete: a renovação da Licença Sanitária deve ser protocolada com pelo menos 60 dias de antecedência.</p>
            </div>`;

            try {
              const { sendLovableEmail } = await import("@lovable.dev/email-js");
              await sendLovableEmail({
                apiKey: process.env.LOVABLE_API_KEY!,
                from: "IGESDF Compliance <notify@lovable.app>",
                to: destinatario, subject, html,
              } as any);
              await supabaseAdmin.from("notificacoes_vencimento").insert({
                licenca_id: l.id, dias_antes: dias, destinatario,
              });
              enviados.push({ licenca: l.id, dias });
            } catch (e: any) {
              console.error("Falha email:", e?.message);
            }
          }
        }

        return Response.json({ ok: true, enviados });
      },
    },
  },
});
