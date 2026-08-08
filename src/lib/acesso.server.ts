import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { getCookie, setCookie, deleteCookie, getRequest } from "@tanstack/react-start/server";

/**
 * Acesso por senha única partilhada, sem cadastro nem contas individuais.
 *
 * Como funciona: a senha é comparada no servidor com `ACESSO_SENHA` e, se
 * confere, é emitido um cookie assinado (HttpOnly) com prazo de validade. Toda
 * a leitura e escrita de dados exige esse cookie.
 *
 * Por que a senha tem de ser verificada no servidor e o acesso aos dados passar
 * pela service role: a chave publicável do Supabase viaja no pacote enviado ao
 * navegador. Se as tabelas aceitassem o papel `anon`, qualquer pessoa poderia
 * falar diretamente com a API REST do Supabase e ignorar a senha por completo —
 * a barreira não protegeria nada. Mantendo as políticas RLS fechadas ao `anon`
 * e servindo os dados apenas através das funções de servidor, a senha passa a
 * ser a única porta de entrada.
 *
 * A chave do HMAC é a própria senha: trocar `ACESSO_SENHA` invalida
 * imediatamente todas as sessões já abertas.
 */

const COOKIE = "igesdf_acesso";
const VALIDADE_DIAS = 30;

/** Perfis de acesso: quem pode alterar dados e quem só consulta/imprime. */
export type Perfil = "edicao" | "leitura";

function senhaConfigurada(): string {
  const senha = process.env.ACESSO_SENHA;
  if (!senha || senha.trim().length < 4) {
    throw new Error(
      "ACESSO_SENHA não está configurada no ambiente. Defina uma senha de acesso " +
        "com pelo menos 4 caracteres nas variáveis de ambiente do projeto.",
    );
  }
  return senha;
}

/**
 * Senha de consulta (opcional). Quando não está definida, existe apenas o
 * perfil de edição — o sistema continua a funcionar como antes.
 */
function senhaLeitura(): string | null {
  const senha = process.env.ACESSO_SENHA_LEITURA;
  if (!senha || senha.trim().length < 4) return null;
  return senha;
}

function assinar(payload: string, senha: string): string {
  return createHmac("sha256", senha).update(payload).digest("hex");
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual exige o mesmo comprimento; comparar tamanhos primeiro não
  // vaza informação útil sobre o conteúdo.
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * O sistema é aberto dentro de um iframe (pré-visualização do editor e alguns
 * portais internos). Nesse contexto o pedido é "cross-site" para o navegador,
 * e um cookie `SameSite=Lax` simplesmente não é reenviado — a senha era aceite
 * mas o guarda de rota continuava a ver a sessão como fechada, devolvendo o
 * utilizador ao ecrã de acesso. Em HTTPS usamos `SameSite=None; Secure`, que é
 * a única combinação que o navegador aceita em iframe; em HTTP local mantemos
 * `Lax`, porque `None` sem `Secure` é rejeitado.
 */
function ligacaoSegura(): boolean {
  try {
    const req = getRequest();
    if (req?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https") return true;
    if (req?.url?.startsWith("https://")) return true;
  } catch {
    /* fora de um pedido */
  }
  return false;
}

/** Emite o cookie de acesso após uma senha correta, gravando o perfil. */
export function abrirSessao(perfil: Perfil = "edicao"): void {
  const senha = senhaConfigurada();
  const expiraEm = Date.now() + VALIDADE_DIAS * 86_400_000;
  // O identificador aleatório só serve para os cookies não serem todos iguais.
  const payload = `${expiraEm}.${randomUUID()}.${perfil}`;
  const valor = `${payload}.${assinar(payload, senha)}`;
  const seguro = ligacaoSegura();
  setCookie(COOKIE, valor, {
    httpOnly: true,
    sameSite: seguro ? "none" : "lax",
    secure: seguro,
    path: "/",
    maxAge: VALIDADE_DIAS * 86_400,
  });
}

export function fecharSessao(): void {
  const seguro = ligacaoSegura();
  deleteCookie(COOKIE, { path: "/", sameSite: seguro ? "none" : "lax", secure: seguro });
}

/**
 * Limite de tentativas por origem.
 *
 * Uma senha curta e numérica cai rapidamente a força bruta se o servidor
 * aceitar pedidos sem limite — só o atraso por tentativa não basta, porque nada
 * impede milhares de pedidos em paralelo. Aqui a origem é bloqueada por 15
 * minutos após 8 tentativas erradas.
 *
 * O estado é em memória: num ambiente com várias instâncias o limite aplica-se
 * por instância, não globalmente. Continua a elevar muito o custo do ataque,
 * mas não substitui uma senha longa.
 */
const TENTATIVAS_MAX = 8;
const JANELA_MS = 15 * 60_000;
const tentativas = new Map<string, { contagem: number; expira: number }>();

function origem(): string {
  const req = getRequest();
  return (
    req?.headers.get("cf-connecting-ip") ??
    req?.headers.get("x-real-ip") ??
    req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecida"
  );
}

/** Erro atirado quando a origem excedeu o limite de tentativas. */
export class TentativasExcedidas extends Error {
  constructor(public readonly minutos: number) {
    super(`Muitas tentativas de acesso. Aguarde ${minutos} minuto(s) antes de tentar novamente.`);
    this.name = "TentativasExcedidas";
  }
}

function verificarLimite(): void {
  const chave = origem();
  const registo = tentativas.get(chave);
  if (registo && registo.expira > Date.now() && registo.contagem >= TENTATIVAS_MAX) {
    throw new TentativasExcedidas(Math.ceil((registo.expira - Date.now()) / 60_000));
  }
}

function registarFalha(): void {
  const chave = origem();
  const agora = Date.now();
  const registo = tentativas.get(chave);
  if (!registo || registo.expira <= agora) {
    tentativas.set(chave, { contagem: 1, expira: agora + JANELA_MS });
  } else {
    registo.contagem += 1;
  }
  // Limpeza oportunista para o mapa não crescer indefinidamente.
  if (tentativas.size > 5_000) {
    for (const [k, v] of tentativas) if (v.expira <= agora) tentativas.delete(k);
  }
}

/**
 * Confere a senha recebida, em tempo constante, aplicando o limite de
 * tentativas. Devolve o perfil correspondente ou `null` se não confere.
 * As duas comparações correm sempre, para não distinguir os casos pelo tempo.
 */
export function perfilDaSenha(tentativa: string): Perfil | null {
  verificarLimite();
  const edicao = iguais(tentativa, senhaConfigurada());
  const leitura = (() => {
    const s = senhaLeitura();
    return s ? iguais(tentativa, s) : false;
  })();
  const perfil: Perfil | null = edicao ? "edicao" : leitura ? "leitura" : null;
  if (perfil) tentativas.delete(origem());
  else registarFalha();
  return perfil;
}

/**
 * Perfil da sessão atual, ou `null` quando não há cookie válido.
 *
 * Cookies antigos (sem o segmento de perfil) continuam válidos e são tratados
 * como perfil de edição, para não expulsar quem já estava dentro.
 */
export function perfilAtual(): Perfil | null {
  const bruto = getCookie(COOKIE);
  if (!bruto) return null;
  const partes = bruto.split(".");
  if (partes.length !== 3 && partes.length !== 4) return null;
  const assinatura = partes[partes.length - 1]!;
  const payload = partes.slice(0, -1).join(".");
  const perfil: Perfil = partes.length === 4 && partes[2] === "leitura" ? "leitura" : "edicao";

  let senha: string;
  try {
    senha = senhaConfigurada();
  } catch {
    // Sem senha configurada não há sessão válida possível.
    return null;
  }

  if (!iguais(assinatura, assinar(payload, senha))) return null;
  const prazo = Number(partes[0]);
  return Number.isFinite(prazo) && prazo > Date.now() ? perfil : null;
}

/** Verdadeiro quando o pedido traz um cookie de acesso válido e não expirado. */
export function temAcesso(): boolean {
  return perfilAtual() !== null;
}

/** Verdadeiro quando a sessão pode criar, alterar e excluir dados. */
export function podeEditar(): boolean {
  return perfilAtual() === "edicao";
}
