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

/** Emite o cookie de acesso após uma senha correta. */
export function abrirSessao(): void {
  const senha = senhaConfigurada();
  const expiraEm = Date.now() + VALIDADE_DIAS * 86_400_000;
  // O identificador aleatório só serve para os cookies não serem todos iguais.
  const payload = `${expiraEm}.${randomUUID()}`;
  const valor = `${payload}.${assinar(payload, senha)}`;
  setCookie(COOKIE, valor, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VALIDADE_DIAS * 86_400,
  });
}

export function fecharSessao(): void {
  deleteCookie(COOKIE, { path: "/" });
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
 * Confere a senha recebida contra a configurada, em tempo constante, aplicando
 * o limite de tentativas. Um acerto limpa o contador da origem.
 */
export function senhaCorreta(tentativa: string): boolean {
  verificarLimite();
  const senha = senhaConfigurada();
  const certo = iguais(tentativa, senha);
  if (certo) tentativas.delete(origem());
  else registarFalha();
  return certo;
}

/** Verdadeiro quando o pedido traz um cookie de acesso válido e não expirado. */
export function temAcesso(): boolean {
  const bruto = getCookie(COOKIE);
  if (!bruto) return false;
  const partes = bruto.split(".");
  if (partes.length !== 3) return false;
  const [expiraEm, id, assinatura] = partes;
  const payload = `${expiraEm}.${id}`;

  let senha: string;
  try {
    senha = senhaConfigurada();
  } catch {
    // Sem senha configurada não há sessão válida possível.
    return false;
  }

  if (!iguais(assinatura, assinar(payload, senha))) return false;
  const prazo = Number(expiraEm);
  return Number.isFinite(prazo) && prazo > Date.now();
}
