/**
 * As tabelas do IGESDF só são acessíveis pelo servidor (a aplicação web usa a
 * mesma via, protegida por senha partilhada). As ferramentas MCP só chegam aqui
 * depois de `exigirAutorizacao` validar o token OAuth e a lista de e-mails.
 */
export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function texto(valor: unknown): string {
  return JSON.stringify(valor, null, 2);
}
