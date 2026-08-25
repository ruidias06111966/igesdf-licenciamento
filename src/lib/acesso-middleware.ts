import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ClaimsAcesso = {
  email?: unknown;
  user_metadata?: unknown;
};

function identidadeDasClaims(userId: string, claims: ClaimsAcesso) {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) {
    throw new Error("Unauthorized: a sessão não contém um e-mail válido.");
  }

  const metadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? (claims.user_metadata as Record<string, unknown>)
      : {};
  const nomeBruto = metadata.nome ?? metadata.full_name;

  return {
    userId,
    email,
    nome: typeof nomeBruto === "string" && nomeBruto.trim() ? nomeBruto.trim() : null,
  };
}

async function sessaoValidada(userId: string, claims: ClaimsAcesso) {
  const { sessaoDaIdentidade } = await import("@/lib/acesso.server");
  return sessaoDaIdentidade(identidadeDasClaims(userId, claims));
}

/**
 * Exige uma conta autorizada e entrega o cliente Supabase com service role.
 *
 * A identidade vem do token da sessão (conta individual, e-mail confirmado) e o
 * perfil da tabela `perfis_acesso`, atribuído pelo master. A service role
 * ignora RLS — é intencional: as políticas continuam fechadas ao navegador, e
 * todo o acesso a dados passa por estas funções, onde o perfil é conferido.
 */
export const requireAcesso = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
  const sessao = await sessaoValidada(context.userId, context.claims);
  if (!sessao.perfil) {
    throw new Error(
      "A sua conta ainda não foi autorizada pelo utilizador master. Aguarde a liberação.",
    );
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return next({ context: { supabase: supabaseAdmin, sessao } });
});

/**
 * Exige o perfil de edição (ou master). O perfil de consulta abre o sistema em
 * modo apenas-leitura: esconder os botões não chega, porque as funções de
 * servidor são chamáveis diretamente — a barreira tem de estar aqui.
 */
export const requireEdicao = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
  const sessao = await sessaoValidada(context.userId, context.claims);
  if (!sessao.perfil) {
    throw new Error(
      "A sua conta ainda não foi autorizada pelo utilizador master. Aguarde a liberação.",
    );
  }
  if (sessao.perfil !== "edicao" && sessao.perfil !== "master") {
    throw new Error(
      "Este acesso é apenas para consulta e impressão. Para alterar dados, peça ao master o perfil de edição.",
    );
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return next({ context: { supabase: supabaseAdmin, sessao } });
});

/**
 * Exige o perfil master. Usado pelos módulos que produzem documentos oficiais
 * (assistente de IA, despachos e consolidado da rede) e pela gestão de
 * utilizadores — esconder o menu não bastaria, porque as funções são chamáveis.
 */
export const requireMaster = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
  const sessao = await sessaoValidada(context.userId, context.claims);
  if (sessao.perfil !== "master") {
    throw new Error("Este módulo é reservado ao acesso master.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return next({ context: { supabase: supabaseAdmin, sessao } });
});
