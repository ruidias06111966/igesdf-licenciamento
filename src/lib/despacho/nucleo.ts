/**
 * Núcleo dos despachos: tradução entre o vocabulário do sistema (estado da
 * licença) e o vocabulário do documento oficial (classificação + situação
 * perante o órgão), montagem de blocos e conversão para HTML/Markdown.
 *
 * Fica separado dos ecrãs porque é este ficheiro que decide o texto que sai
 * assinado — tem de ser lido e testado sem depender de React.
 */
import { orgaoLabel, type Orgao, type StatusLicenca } from "@/lib/domain";
import { formatDate } from "@/lib/dates";

export type Classe = "licenciada" | "dispensada" | "nao_licenciada";
export type Situacao = "" | "aguardando" | "em_estudo" | "pendente_com" | "indeferida";

export const CLASSE_LABEL: Record<Classe, string> = {
  licenciada: "Licenciada",
  dispensada: "Dispensada",
  nao_licenciada: "Não licenciada",
};

export const SITUACAO_LABEL: Record<Exclude<Situacao, "">, string> = {
  aguardando: "Aguardando manifestação do órgão",
  em_estudo: "Em estudo",
  pendente_com: "Pendente de comunicação do IGESDF",
  indeferida: "Indeferida",
};

export type Responsavel = "resolvido" | "igesdf" | "orgao";

export const RESPONSAVEL_LABEL: Record<Responsavel, string> = {
  resolvido: "Sem pendência",
  igesdf: "Ação do IGESDF",
  orgao: "Ação do órgão",
};

/** Uma linha do quadro: um CNAE perante um órgão. */
export type ItemDespacho = {
  licenca_id: string | null;
  orgao: Orgao;
  cnae: string;
  cnae_desc: string;
  classe: Classe;
  situacao: Situacao;
  /** ISO (yyyy-mm-dd) ou null. */
  validade: string | null;
  /** Estado original gravado, para saber o que mudou ao gravar de volta. */
  status: StatusLicenca;
  /** Última alteração registada na licença (base do tempo de permanência). */
  atualizado_em: string | null;
};

export function classificar(status: StatusLicenca): { classe: Classe; situacao: Situacao } {
  switch (status) {
    case "vigente":
    case "a_vencer":
    case "vencida":
      return { classe: "licenciada", situacao: "" };
    case "dispensada":
      return { classe: "dispensada", situacao: "" };
    case "indeferida":
      return { classe: "nao_licenciada", situacao: "indeferida" };
    case "em_analise":
    case "aguardando_orgao":
      return { classe: "nao_licenciada", situacao: "aguardando" };
    case "em_estudo":
      return { classe: "nao_licenciada", situacao: "em_estudo" };
    default:
      return { classe: "nao_licenciada", situacao: "pendente_com" };
  }
}

/**
 * Caminho inverso, usado quando o despacho grava de volta na base. Mantém o
 * estado original quando ele já corresponde à classificação escolhida, para
 * não trocar "a vencer" por "vigente" sem necessidade.
 */
export function paraStatus(item: ItemDespacho): StatusLicenca {
  const atual = classificar(item.status);
  if (atual.classe === item.classe && atual.situacao === item.situacao) return item.status;
  if (item.classe === "licenciada") return "vigente";
  if (item.classe === "dispensada") return "dispensada";
  switch (item.situacao) {
    case "indeferida":
      return "indeferida";
    case "aguardando":
      return "aguardando_orgao";
    case "em_estudo":
      return "em_estudo";
    default:
      return "pendente_declaracao";
  }
}

export function vencida(item: ItemDespacho): boolean {
  if (item.classe !== "licenciada" || !item.validade) return false;
  return item.validade < hojeIso();
}

export function responsavel(item: ItemDespacho): Responsavel {
  if (vencida(item)) return "igesdf";
  if (item.classe === "licenciada" || item.classe === "dispensada") return "resolvido";
  return item.situacao === "aguardando" ? "orgao" : "igesdf";
}

export function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function diasEntre(desde: string | null | undefined, ate = hojeIso()): number | null {
  if (!desde) return null;
  const a = Date.parse(desde);
  const b = Date.parse(ate);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export const dataBr = (iso: string | null | undefined) => (iso ? formatDate(iso) : "—");

export const sigla = (orgao: string | null | undefined) => orgaoLabel(orgao);

// ---------- blocos do documento ----------

export type Bloco =
  | { t: "titulo"; texto: string }
  | { t: "p"; texto: string }
  | { t: "lista"; itens: string[] }
  | { t: "tabela"; cab: string[]; linhas: string[][] }
  | { t: "assinatura"; linhas: { nome: string; cargo: string }[]; local: string };

function escapar(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(t: string) {
  return escapar(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** HTML pronto a colar no editor do SEI (tabelas e negrito preservados). */
export function blocosParaHtml(blocos: Bloco[]): string {
  return blocos
    .map((b) => {
      switch (b.t) {
        case "titulo":
          return `<h4>${inline(b.texto)}</h4>`;
        case "p":
          return `<p>${inline(b.texto)}</p>`;
        case "lista":
          return `<ul>${b.itens.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`;
        case "tabela":
          return (
            `<table border="1" cellspacing="0" cellpadding="4"><thead><tr>` +
            b.cab.map((c) => `<th>${inline(c)}</th>`).join("") +
            `</tr></thead><tbody>` +
            b.linhas
              .map((l) => `<tr>${l.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
              .join("") +
            `</tbody></table>`
          );
        case "assinatura":
          return (
            `<p>${inline(b.local)}</p>` +
            b.linhas
              .map((a) => `<p><strong>${escapar(a.nome)}</strong><br>${escapar(a.cargo)}</p>`)
              .join("")
          );
      }
    })
    .join("\n");
}

/** Markdown, usado ao guardar na biblioteca de modelos e ao exportar. */
export function blocosParaMarkdown(blocos: Bloco[]): string {
  return blocos
    .map((b) => {
      switch (b.t) {
        case "titulo":
          return `## ${b.texto}`;
        case "p":
          return b.texto;
        case "lista":
          return b.itens.map((i) => `- ${i}`).join("\n");
        case "tabela":
          return b.linhas.map((l) => `- ${l.join(" | ")}`).join("\n");
        case "assinatura":
          return [b.local, ...b.linhas.map((a) => `**${a.nome}**\n${a.cargo}`)].join("\n\n");
      }
    })
    .join("\n\n");
}

/** Texto simples, para quem cola num campo sem formatação. */
export function blocosParaTexto(blocos: Bloco[]): string {
  return blocosParaMarkdown(blocos)
    .replace(/\*\*/g, "")
    .replace(/^## /gm, "")
    .trim();
}

export function csvDeQuadro(cab: string[], linhas: string[][]): string {
  const esc = (c: string) => `"${String(c ?? "").replace(/"/g, '""')}"`;
  return (
    "\uFEFF" + [cab, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n")
  );
}

export function competenciaLabel(iso: string): string {
  const [ano, mes] = iso.split("-");
  const nomes = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const i = Number(mes) - 1;
  return nomes[i] ? `${nomes[i]} de ${ano}` : iso;
}