import { FROM_DOMAIN, SENDER_DOMAIN } from "@/lib/email-templates/dominio";
import { MARCA } from "@/lib/marca";

/**
 * Por onde saem os e-mails do sistema.
 *
 * Tal como no assistente, os dois caminhos coexistem e a escolha é uma variável
 * de ambiente: com `RESEND_API_KEY` definida os e-mails saem pela Resend; sem
 * ela, continuam pela Lovable. Trocar de um dia para o outro deixaria o sistema
 * sem enviar nada entre a mudança do código e a chegada da chave — e o que não
 * sai são confirmações de conta, recuperações de senha e alertas de vencimento.
 *
 * A Resend foi a escolhida por uma razão prática: os modelos já são React Email
 * (`@react-email/render`), que é a casa dela, e a API é um POST — não entra
 * dependência nova no projeto para isto.
 */

export type EmailParaEnviar = {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
  /** Evita duplicados quando a mesma mensagem é tentada duas vezes. */
  chaveIdempotencia?: string;
  responderPara?: string;
  /** Etiqueta para os registos do provedor (ex.: nome do modelo). */
  etiqueta?: string;
};

export type ResultadoEnvio =
  { enviado: true } | { enviado: false; motivo: "destinatario_suprimido" };

export function provedorEmail(): "resend" | "lovable" | null {
  if (process.env["RESEND_API_KEY"]?.trim()) return "resend";
  if (process.env["LOVABLE_API_KEY"]?.trim()) return "lovable";
  return null;
}

/** Remetente apresentado, montado a partir da marca e do domínio verificado. */
export function remetente(): string {
  return `${MARCA.produto} <noreply@${FROM_DOMAIN}>`;
}

export async function enviarEmail(email: EmailParaEnviar): Promise<ResultadoEnvio> {
  const provedor = provedorEmail();
  if (provedor === "resend") return enviarPelaResend(email);
  if (provedor === "lovable") return enviarPelaLovable(email);
  throw new Error("Nenhum serviço de e-mail configurado (RESEND_API_KEY ou LOVABLE_API_KEY).");
}

/* ------------------------------------------------------------------ */

async function enviarPelaResend(email: EmailParaEnviar): Promise<ResultadoEnvio> {
  const chave = process.env["RESEND_API_KEY"]!.trim();
  const cabecalhos: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${chave}`,
  };
  // A Resend deduplica por esta chave durante 24 horas.
  if (email.chaveIdempotencia) cabecalhos["Idempotency-Key"] = email.chaveIdempotencia;

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: cabecalhos,
    body: JSON.stringify({
      from: remetente(),
      to: [email.para],
      subject: email.assunto,
      html: email.html,
      text: email.texto,
      reply_to: email.responderPara,
      tags: email.etiqueta ? [{ name: "modelo", value: email.etiqueta }] : undefined,
    }),
  });

  if (resposta.ok) return { enviado: true };

  const detalhe = await resposta.text().catch(() => "");
  // Um endereço que se descadastrou ou rejeitou não é falha da operação: o
  // registo grava-se na mesma e ninguém tem de ver um erro por causa disso.
  if (resposta.status === 422 && /suppress|unsubscribe|bounce/i.test(detalhe)) {
    return { enviado: false, motivo: "destinatario_suprimido" };
  }
  throw new Error(`Resend respondeu ${resposta.status}: ${detalhe}`);
}

async function enviarPelaLovable(email: EmailParaEnviar): Promise<ResultadoEnvio> {
  const { EmailAPIError, sendLovableEmail } = await import("@lovable.dev/email-js");
  try {
    await sendLovableEmail(
      {
        to: email.para,
        from: remetente(),
        sender_domain: SENDER_DOMAIN,
        subject: email.assunto,
        html: email.html,
        text: email.texto ?? "",
        purpose: "transactional",
        label: email.etiqueta,
        idempotency_key: email.chaveIdempotencia || crypto.randomUUID(),
        reply_to: email.responderPara,
      },
      { apiKey: process.env["LOVABLE_API_KEY"]!, sendUrl: process.env["LOVABLE_SEND_URL"] },
    );
  } catch (erro) {
    if (erro instanceof EmailAPIError && erro.code === "recipient_suppressed") {
      return { enviado: false, motivo: "destinatario_suprimido" };
    }
    throw erro;
  }
  return { enviado: true };
}
