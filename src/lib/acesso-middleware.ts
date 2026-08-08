import { createMiddleware } from "@tanstack/react-start";

/**
 * Exige o cookie de acesso e entrega o cliente Supabase com service role.
 *
 * Substitui o antigo `requireSupabaseAuth`, que exigia um JWT de utilizador do
 * Supabase. Como o sistema deixou de ter contas individuais, não existe JWT: a
 * autorização passou a ser o cookie de senha partilhada, e o acesso ao banco é
 * feito com a service role no servidor.
 *
 * A service role ignora RLS. Isso é intencional e é o que mantém a senha com
 * significado: as políticas RLS continuam fechadas ao papel `anon`, portanto a
 * chave publicável que viaja no navegador não consegue ler nem escrever nada
 * diretamente na API REST do Supabase. Todo o acesso a dados passa por aqui.
 *
 * A chave nunca chega ao cliente: `client.server.ts` é importado dinamicamente
 * dentro do handler, que só corre no servidor.
 */
export const requireAcesso = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { temAcesso } = await import("@/lib/acesso.server");
  if (!temAcesso()) {
    throw new Error("Unauthorized: acesso não autorizado");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return next({ context: { supabase: supabaseAdmin } });
});

/**
 * Exige, além do cookie, o perfil de edição. A senha de consulta abre o
 * sistema em modo apenas-leitura: esconder os botões não chega, porque as
 * funções de servidor são chamáveis diretamente — a barreira tem de estar aqui.
 */
export const requireEdicao = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { perfilAtual } = await import("@/lib/acesso.server");
  const perfil = perfilAtual();
  if (perfil === null) {
    throw new Error("Unauthorized: acesso não autorizado");
  }
  if (perfil !== "edicao") {
    throw new Error(
      "Este acesso é apenas para consulta e impressão. Para alterar dados, entre com a senha de edição.",
    );
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return next({ context: { supabase: supabaseAdmin } });
});
