import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  // `attachSupabaseAuth` foi retirado: anexava o Bearer token da sessão Supabase
  // a cada chamada de função de servidor. Sem contas individuais não existe
  // token, e a autorização viaja no cookie de acesso, que o navegador envia
  // automaticamente. Mantê-lo obrigava a instanciar o cliente Supabase no
  // navegador a cada pedido, sem qualquer efeito.
  requestMiddleware: [errorMiddleware],
  // Antes, o portão de autenticação lia a sessão do localStorage, invisível ao
  // servidor: ao abrir /dashboard sem sessão o servidor enviava o HTML da rota
  // protegida e o cliente redirecionava para /auth, renderizando outra árvore no
  // mesmo lugar — o React acusava "Hydration failed" e regerava tudo no cliente.
  // O portão passou a ser um cookie, que o servidor lê, mas as páginas continuam
  // a buscar os dados no cliente, então renderizá-las no servidor não traria
  // ganho e voltaria a abrir espaço para descasamentos.
  //
  // Todas as páginas já estavam marcadas individualmente como `ssr: false`;
  // declarar aqui o padrão torna a regra explícita e elimina o descasamento.
  // O <head> continua a ser renderizado no servidor, por isso title,
  // description e canonical de cada rota permanecem no HTML inicial.
  defaultSsr: false,
}));
