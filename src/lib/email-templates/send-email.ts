import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES, type DadosTemplate } from "./registry";
import { enviarEmail } from "@/lib/email/enviar.server";

// Só servidor: o envio lê a chave do provedor. Nunca importar de componentes
// que corram no navegador.

export type SendTemplateEmailResult =
  { sent: true } | { sent: false; reason: "recipient_suppressed" };

export interface SendTemplateEmailOptions {
  templateData?: DadosTemplate;
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string;
  replyTo?: string;
}

/**
 * Renders a registered template and sends it through Lovable's managed email
 * API. Suppression, retries, and rate limits are enforced by Lovable
 * server-side. A suppressed recipient is an expected outcome
 * ({ sent: false }); any other failure throws — EmailAPIError exposes
 * .code and .status for branching.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const resultado = await enviarEmail({
    para: recipient,
    assunto: subject,
    html,
    texto: text,
    etiqueta: templateName,
    chaveIdempotencia: options.idempotencyKey,
    responderPara: options.replyTo,
  });
  if (!resultado.enviado) return { sent: false, reason: "recipient_suppressed" };

  return { sent: true };
}
