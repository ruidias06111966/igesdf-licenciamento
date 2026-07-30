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
    const { senhaCorreta, abrirSessao, TentativasExcedidas } = await import("@/lib/acesso.server");
    try {
      if (!senhaCorreta(data.senha)) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        return { ok: false as const, motivo: "senha" as const };
      }
    } catch (erro) {
      if (erro instanceof TentativasExcedidas) {
        return { ok: false as const, motivo: "limite" as const, mensagem: erro.message };
      }
      throw erro;
    }
    abrirSessao();
    return { ok: true as const };
  });

export const sair = createServerFn({ method: "POST" }).handler(async () => {
  const { fecharSessao } = await import("@/lib/acesso.server");
  fecharSessao();
  return { ok: true };
});

/** Usada pelo guarda de rota para saber se já existe sessão aberta. */
export const verificarAcesso = createServerFn({ method: "GET" }).handler(async () => {
  const { temAcesso } = await import("@/lib/acesso.server");
  return { autorizado: temAcesso() };
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
