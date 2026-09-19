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
