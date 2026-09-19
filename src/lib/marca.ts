/**
 * Identidade do produto.
 *
 * O sistema passou a ser um produto da suíte QiDominios — QiLicenciamentos —
 * servindo o IGESDF como cliente. Antes o nome do cliente estava escrito à mão
 * em 185 sítios, em três variantes diferentes ("IGESDF - Licenciamento",
 * "IGESDF Licenciamento", "IGESDF"), o que tornava impossível servir outro
 * cliente sem reescrever o sistema inteiro.
 *
 * Marca do produto e identidade do cliente são coisas distintas e ficam
 * separadas aqui: os títulos, a barra lateral e o ecrã de entrada usam o
 * produto; as descrições do que os dados representam continuam a nomear o
 * cliente, porque é um facto sobre o conteúdo, não uma questão de marca.
 */

export const MARCA = {
  /** Nome do produto, usado em títulos e na interface. */
  produto: "QiLicenciamentos",
  /** Suíte a que o produto pertence. */
  suite: "QiDominios",
  descricao: "Gestão de licenciamentos, alvarás e prazos de renovação",
  dominio: "qilicenciamento.qidominios.com.br",
  url: "https://qilicenciamento.qidominios.com.br",
} as const;

/**
 * Cliente cujos dados o sistema gere.
 *
 * Isolado para que um segundo cliente seja uma mudança de configuração, e não
 * uma caça a cadeias de texto pelo código todo.
 */
export const CLIENTE = {
  sigla: "IGESDF",
  nome: "Instituto de Gestão Estratégica de Saúde do Distrito Federal",
  descricao: "rede hospitalar do Distrito Federal (hospitais, UPAs e unidades administrativas)",
} as const;

/** Título de página, no formato usado em todo o sistema. */
export function titulo(pagina: string): string {
  return `${pagina} — ${MARCA.produto}`;
}

/**
 * URL absoluto de um caminho, para canonical, og:url e sitemap.
 *
 * Sem argumento devolve a raiz sem barra final, para poder ser concatenada com
 * caminhos sem produzir `//`.
 */
export function url(caminho = ""): string {
  if (!caminho || caminho === "/") return MARCA.url;
  return `${MARCA.url}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}
