import { getRequest } from "@tanstack/react-start/server";

/**
 * Acesso por conta individual.
 *
 * Cada pessoa cria a sua conta (e-mail + senha), confirma o e-mail e fica
 * pendente até o utilizador master lhe atribuir um perfil. A identidade vem do
 * token da sessão (validado aqui no servidor); o perfil vem da tabela
 * `perfis_acesso`.
 *
 * O acesso aos dados continua a ser feito com a service role dentro das funções
 * de servidor: as políticas RLS estão fechadas ao papel `anon`/`authenticated`,
 * portanto a chave publicável que viaja no navegador não lê nem escreve nada
 * diretamente na API REST — tudo passa por aqui, onde o perfil é conferido.
 */

export type Perfil = "edicao" | "leitura" | "master";

export type Sessao = {
  userId: string;
  email: string;
  nome: string | null;
  /** `null` significa conta confirmada mas ainda sem autorização do master. */
  perfil: Perfil | null;
  suspenso: boolean;
};

/** Conta que é sempre master — a do responsável pelo sistema. */
function emailMaster(): string {
  return (process.env.ACESSO_MASTER_EMAIL || "qidominio@gmail.com").toLowerCase().trim();
}

function tokenDoPedido(): string | null {
  try {
    const req = getRequest();
    const header = req?.headers.get("authorization") ?? "";
    if (!header.startsWith("Bearer ")) return null;
    const token = header.slice(7).trim();
    return token && token.split(".").length === 3 ? token : null;
  } catch {
    return null;
  }
}

/** Valida o token da sessão e devolve a identidade, ou `null`. */
async function identidade(): Promise<{
  userId: string;
  email: string;
  nome: string | null;
} | null> {
  const token = tokenDoPedido();
  if (!token) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const resposta = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) return null;
  const user = (await resposta.json()) as {
    id?: string;
    email?: string;
    email_confirmed_at?: string | null;
    user_metadata?: { nome?: string; full_name?: string };
  };
  if (!user.id || !user.email) return null;
  // Sem e-mail confirmado não há entrada: a confirmação é o que prova que o
  // endereço pertence mesmo a quem se cadastrou.
  if (!user.email_confirmed_at) return null;
  return {
    userId: user.id,
    email: user.email.toLowerCase(),
    nome: user.user_metadata?.nome ?? user.user_metadata?.full_name ?? null,
  };
}

export type IdentidadeConfirmada = {
  userId: string;
  email: string;
  nome: string | null;
};

/**
 * Sessão atual: identidade validada + perfil atribuído.
 *
 * Na primeira entrada de cada conta é criado o respetivo registo em
 * `perfis_acesso` (pendente), para o master a poder autorizar. A conta do
 * responsável é promovida a master automaticamente.
 */
export async function sessaoDaIdentidade(eu: IdentidadeConfirmada): Promise<Sessao> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("perfis_acesso")
    .select("user_id, email, nome, perfil, suspenso")
    .eq("user_id", eu.userId)
    .maybeSingle();

  const ehResponsavel = eu.email === emailMaster();

  if (!data) {
    // A conta pode ter sido recriada (mesmo e-mail, novo id). Nesse caso há um
    // registo antigo pelo e-mail — herda-se esse registo, com a autorização já
    // dada pelo master, em vez de tentar inserir e violar o índice único.
    const { data: porEmail } = await supabaseAdmin
      .from("perfis_acesso")
      .select("user_id, email, nome, perfil, suspenso")
      .ilike("email", eu.email)
      .maybeSingle();

    if (porEmail) {
      const perfil: Perfil | null = ehResponsavel
        ? "master"
        : ((porEmail.perfil as Perfil | null) ?? null);
      const suspenso = ehResponsavel ? false : porEmail.suspenso;
      await supabaseAdmin
        .from("perfis_acesso")
        .update({
          user_id: eu.userId,
          nome: porEmail.nome ?? eu.nome,
          perfil,
          suspenso,
          ultimo_acesso: new Date().toISOString(),
        })
        .eq("user_id", porEmail.user_id);
      return {
        userId: eu.userId,
        email: eu.email,
        nome: porEmail.nome ?? eu.nome,
        perfil: suspenso ? null : perfil,
        suspenso,
      };
    }

    const perfilInicial: Perfil | null = ehResponsavel ? "master" : null;
    await supabaseAdmin.from("perfis_acesso").insert({
      user_id: eu.userId,
      email: eu.email,
      nome: eu.nome,
      perfil: perfilInicial,
      autorizado_em: perfilInicial ? new Date().toISOString() : null,
      ultimo_acesso: new Date().toISOString(),
    });
    return {
      userId: eu.userId,
      email: eu.email,
      nome: eu.nome,
      perfil: perfilInicial,
      suspenso: false,
    };
  }

  // A conta do responsável nunca pode ficar sem acesso ao próprio sistema.
  if (ehResponsavel && (data.perfil !== "master" || data.suspenso)) {
    await supabaseAdmin
      .from("perfis_acesso")
      .update({ perfil: "master", suspenso: false })
      .eq("user_id", eu.userId);
    data.perfil = "master";
    data.suspenso = false;
  }

  await supabaseAdmin
    .from("perfis_acesso")
    .update({ ultimo_acesso: new Date().toISOString(), email: eu.email })
    .eq("user_id", eu.userId);

  return {
    userId: eu.userId,
    email: eu.email,
    nome: data.nome ?? eu.nome,
    perfil: data.suspenso ? null : ((data.perfil as Perfil | null) ?? null),
    suspenso: data.suspenso,
  };
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const eu = await identidade();
  if (!eu) return null;
  return sessaoDaIdentidade(eu);
}

/** Perfil da sessão, ou `null` quando não há sessão autorizada. */
export async function perfilAtual(): Promise<Perfil | null> {
  return (await sessaoAtual())?.perfil ?? null;
}

/**
 * Rótulo de quem fez a ação, para a trilha de auditoria: o e-mail da conta,
 * com o perfil entre parêntesis.
 */
export async function autorAtual(): Promise<string | null> {
  const s = await sessaoAtual();
  if (!s) return null;
  return s.perfil ? `${s.email} (${s.perfil})` : s.email;
}

export async function temAcesso(): Promise<boolean> {
  return (await perfilAtual()) !== null;
}

export async function podeEditar(): Promise<boolean> {
  const p = await perfilAtual();
  return p === "edicao" || p === "master";
}

export async function ehMaster(): Promise<boolean> {
  return (await perfilAtual()) === "master";
}
