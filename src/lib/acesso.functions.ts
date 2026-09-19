import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { requireMaster } from "@/lib/acesso-middleware";

/**
 * Estado da sessão: usado pelo guarda de rota e pela interface para saber se há
 * conta iniciada, se já foi autorizada pelo master e com que perfil.
 */
export const verificarAcesso = createServerFn({ method: "GET" }).handler(async () => {
  const { sessaoAtual } = await import("@/lib/acesso.server");
  const sessao = await sessaoAtual();
  if (!sessao) {
    return {
      sessao: false as const,
      autorizado: false,
      perfil: null,
      email: null,
      suspenso: false,
    };
  }
  return {
    sessao: true as const,
    autorizado: sessao.perfil !== null,
    perfil: sessao.perfil,
    email: sessao.email,
    suspenso: sessao.suspenso,
  };
});

/*
 * Aqui existia o `registarCadastro`: uma função de servidor sem sessão, chamada
 * pelo ecrã de cadastro, que criava já o registo pendente em `perfis_acesso`
 * para o master ver a conta antes de a pessoa confirmar o e-mail.
 *
 * Foi removida por duas razões.
 *
 * A primeira é que não acrescentava nada: o `listarUtilizadores` aqui em baixo
 * já junta à lista do master as contas que existem em `auth.users` sem registo
 * em `perfis_acesso`, e o `definirPerfilUtilizador` já usa `upsert` justamente
 * para poder autorizar uma conta que ainda não tem registo. A conta acabada de
 * criar aparecia ao master de qualquer maneira.
 *
 * A segunda é que, sendo chamável sem sessão, respondia de forma diferente
 * consoante o e-mail já tivesse conta (`{ok: true}`) ou não (`{ok: false}`).
 * Bastava isso para qualquer pessoa, sem conta nenhuma, ir perguntando endereço
 * a endereço e ficar a saber quem está registado no sistema. Não dava acesso a
 * nada, mas dizia quem cá trabalha — e cada chamada varria ainda a lista de
 * contas com a service role.
 *
 * Não se põe uma guarda de perfil no lugar: quem se está a cadastrar não tem
 * sessão, por definição. A correção é o endpoint deixar de existir.
 */

/* ---------------------------------------------------------------------- */
/* Gestão de utilizadores — reservada ao master                            */
/* ---------------------------------------------------------------------- */

/** Quantas contas se pedem de cada vez à API de administração. */
const POR_PAGINA = 200;
/**
 * Travão de segurança: 50 páginas são 10 000 contas, muito acima do que esta
 * rede alguma vez terá. Existe só para uma resposta inesperada da API não pôr
 * o servidor a pedir páginas para sempre.
 */
const MAX_PAGINAS = 50;

/**
 * Todas as contas registadas, percorrendo as páginas até ao fim.
 *
 * Antes pedia-se uma única página de 200. Passando disso, as contas seguintes
 * deixavam de aparecer ao master — e uma conta que ele não vê é uma conta que
 * não pode autorizar, portanto alguém que ficava sem conseguir entrar sem que
 * nada indicasse porquê.
 */
async function todasAsContas(): Promise<User[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const contas: User[] = [];

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: pagina,
      perPage: POR_PAGINA,
    });
    if (error) throw new Error(error.message);
    const lote = data?.users ?? [];
    contas.push(...lote);
    // Uma página incompleta é a última.
    if (lote.length < POR_PAGINA) break;
  }

  return contas;
}

export const listarUtilizadores = createServerFn({ method: "GET" })
  .middleware([requireMaster])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("perfis_acesso")
      .select("user_id, email, nome, perfil, suspenso, autorizado_em, ultimo_acesso, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const perfis = data ?? [];

    // Contas que se cadastraram mas ainda não abriram o sistema não têm registo
    // em `perfis_acesso` — ficariam invisíveis para o master, que nunca as
    // poderia autorizar. Junta-se aqui a lista real de contas.
    const contas = await todasAsContas();
    const conhecidos = new Set(perfis.map((p) => p.user_id));
    const emailsConhecidos = new Set(perfis.map((p) => (p.email ?? "").toLowerCase()));

    const emFalta = contas
      .filter(
        (u) => !!u.email && !conhecidos.has(u.id) && !emailsConhecidos.has(u.email.toLowerCase()),
      )
      .map((u) => ({
        user_id: u.id,
        email: u.email!,
        nome:
          (u.user_metadata as { nome?: string; full_name?: string } | null)?.nome ??
          (u.user_metadata as { full_name?: string } | null)?.full_name ??
          null,
        perfil: null as string | null,
        suspenso: false,
        autorizado_em: null as string | null,
        ultimo_acesso: u.last_sign_in_at ?? null,
        created_at: u.created_at,
      }));

    return [...perfis, ...emFalta].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
  });

const definirSchema = z.object({
  userId: z.string().uuid(),
  perfil: z.enum(["master", "edicao", "leitura"]).nullable(),
  suspenso: z.boolean().optional(),
});

/** Atribui, altera ou retira o perfil de uma conta. */
export const definirPerfilUtilizador = createServerFn({ method: "POST" })
  .middleware([requireMaster])
  .inputValidator((input: unknown) => definirSchema.parse(input))
  .handler(async ({ data, context }) => {
    // O master não se pode remover a si próprio — ficaria um sistema sem quem
    // autorize os restantes.
    if (data.userId === context.sessao.userId && (data.perfil !== "master" || data.suspenso)) {
      throw new Error("Não é possível retirar o seu próprio acesso master.");
    }
    // `upsert` porque a conta pode ainda não ter registo em `perfis_acesso`
    // (confirmou o e-mail mas nunca abriu o sistema).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conta } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const { error } = await context.supabase.from("perfis_acesso").upsert(
      {
        user_id: data.userId,
        email: conta?.user?.email ?? "",
        nome:
          (conta?.user?.user_metadata as { nome?: string; full_name?: string } | null)?.nome ??
          (conta?.user?.user_metadata as { full_name?: string } | null)?.full_name ??
          null,
        perfil: data.perfil,
        suspenso: data.suspenso ?? false,
        autorizado_por: context.sessao.userId,
        autorizado_em: data.perfil ? new Date().toISOString() : null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    const { registarAuditoria } = await import("@/lib/auditoria.server");
    await registarAuditoria(context.supabase, {
      entidade: "perfis_acesso",
      entidade_id: data.userId,
      acao: data.perfil ? "autorizar" : "revogar",
      detalhes: { perfil: data.perfil, suspenso: data.suspenso ?? false },
    });
    return { ok: true };
  });
