import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Entrada no sistema com a senha única da equipa.
 *
 * O atraso fixo em caso de senha errada torna a tentativa por força bruta
 * pouco prática sem precisar de guardar estado de tentativas.
 */
export const entrar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ senha: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { perfilDaSenha, abrirSessao, TentativasExcedidas } = await import("@/lib/acesso.server");
    let perfil: "edicao" | "leitura" | null;
    try {
      perfil = perfilDaSenha(data.senha);
    } catch (erro) {
      if (erro instanceof TentativasExcedidas) {
        return { ok: false as const, motivo: "limite" as const, mensagem: erro.message };
      }
      throw erro;
    }
    if (!perfil) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return { ok: false as const, motivo: "senha" as const };
    }
    abrirSessao(perfil);
    return { ok: true as const, perfil };
  });

export const sair = createServerFn({ method: "POST" }).handler(async () => {
  const { fecharSessao } = await import("@/lib/acesso.server");
  fecharSessao();
  return { ok: true };
});

/** Usada pelo guarda de rota e pela interface para saber a sessão e o perfil. */
export const verificarAcesso = createServerFn({ method: "GET" }).handler(async () => {
  const { perfilAtual } = await import("@/lib/acesso.server");
  const perfil = perfilAtual();
  return { autorizado: perfil !== null, perfil };
});

/**
 * Indica se o ambiente tem `ACESSO_SENHA` definida. Serve para o ecrã de
 * entrada explicar o que falta configurar, em vez de rejeitar toda a senha em
 * silêncio.
 */
export const acessoConfigurado = createServerFn({ method: "GET" }).handler(async () => {
  const senha = process.env.ACESSO_SENHA;
  return { configurado: Boolean(senha && senha.trim().length >= 4) };
});
