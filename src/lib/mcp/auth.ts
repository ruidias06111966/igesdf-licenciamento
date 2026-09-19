import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function env(nome: string): string | undefined {
  return (globalThis as RuntimeGlobals).process?.env?.[nome]?.trim() || undefined;
}

/**
 * No MCP a identidade vem do token OAuth, e não da sessão do navegador, por
 * isso o perfil atribuído em `perfis_acesso` não é consultado aqui: a chamada
 * é restringida às contas de e-mail explicitamente autorizadas em
 * MCP_EMAILS_AUTORIZADOS (lista separada por vírgulas). Sem a lista
 * configurada, nada é autorizado — falha fechado.
 */
export function exigirAutorizacao(ctx: ToolContext): string {
  if (!ctx.isAuthenticated()) {
    throw new ToolError("Não autenticado. Ligue-se com a sua conta autorizada do IGESDF.");
  }
  const email = (ctx.getUserEmail() ?? "").toLowerCase().trim();
  const permitidos = (env("MCP_EMAILS_AUTORIZADOS") ?? "")
    .split(",")
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
  if (permitidos.length === 0) {
    throw new ToolError(
      "Nenhum e-mail autorizado está configurado (MCP_EMAILS_AUTORIZADOS). Contacte o administrador.",
    );
  }
  if (!email || !permitidos.includes(email)) {
    throw new ToolError("A sua conta não está autorizada a aceder aos dados do IGESDF.");
  }
  return email;
}

/**
 * Empresa a que a chamada MCP tem acesso.
 *
 * Aqui a identidade vem do token OAuth e não da sessão do navegador, por isso a
 * empresa é procurada pelo e-mail em `perfis_acesso`. Sem perfil atribuído não
 * há alcance nenhum: estar na lista de e-mails autorizados abre a porta do MCP,
 * não os dados de um cliente.
 */
export async function escopoDoMcp(ctx: ToolContext) {
  const email = exigirAutorizacao(ctx);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("perfis_acesso")
    .select("perfil, empresa_id, suspenso")
    .ilike("email", email)
    .maybeSingle();

  if (!data || data.suspenso || !data.perfil) {
    throw new ToolError("A sua conta não tem perfil atribuído neste sistema.");
  }
  if (data.perfil === "master" && data.empresa_id === null) {
    return { escopo: { global: true as const, empresaId: null }, email };
  }
  if (!data.empresa_id) {
    throw new ToolError("A sua conta não está associada a nenhuma empresa.");
  }
  return { escopo: { global: false as const, empresaId: data.empresa_id }, email };
}
