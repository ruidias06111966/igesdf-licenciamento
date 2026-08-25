/**
 * Documento A4 (capa + legenda + tabela) usado tanto na pré-visualização como
 * na impressão/PDF. Sendo o mesmo HTML nos dois sítios, o que o utilizador vê
 * antes de confirmar é exatamente o que sai no ficheiro.
 */
import { corSituacao, MARCA, SITUACOES_LEGENDA, corPadrao } from "@/lib/exportar/paleta";
import { linhasMetadados, type MetaExport } from "@/lib/exportar/metadados";
import logoIgesdf from "@/assets/igesdf-logo.jpg.asset.json";

/**
 * O documento é aberto noutra janela/iframe, por isso o endereço do logótipo
 * tem de ser absoluto — um caminho relativo não resolveria lá.
 */
function urlLogo() {
  if (typeof window === "undefined") return logoIgesdf.url;
  return new URL(logoIgesdf.url, window.location.origin).href;
}

export type Orientacao = "portrait" | "landscape";

export type DocumentoTabela = {
  titulo: string;
  subtitulo?: string;
  meta?: MetaExport;
  colunas: { cabecalho: string; situacao?: boolean }[];
  linhas: string[][];
  orientacao?: Orientacao;
};

function esc(v: string) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cor(chave: string) {
  return corSituacao(chave) ?? corPadrao(chave);
}

function legendaHtml() {
  return `<div class="legenda">
  <div class="legenda-titulo">Legenda do semáforo de situação</div>
  <div class="legenda-itens">
    ${SITUACOES_LEGENDA.map((s) => {
      const c = cor(s.chave);
      return `<span class="legenda-item"><i style="background:#${c.fundo};border-color:#${c.texto}"></i>${esc(s.rotulo)}</span>`;
    }).join("")}
  </div>
</div>`;
}

function capaHtml(doc: DocumentoTabela) {
  const linhas = linhasMetadados(doc.meta);
  return `<section class="folha capa">
  <div class="marca"><img class="marca-logo" src="${urlLogo()}" alt="IGESDF"><div><div class="marca-nome">IGESDF</div><div class="marca-sub">Núcleo de Licenciamento · NUCON</div></div></div>
  <h1>${esc(doc.titulo)}</h1>
  ${doc.subtitulo ? `<p class="sub">${esc(doc.subtitulo)}</p>` : ""}
  <table class="meta"><tbody>
    ${linhas.map((l) => `<tr><th>${esc(l.rotulo)}</th><td>${esc(l.valor)}</td></tr>`).join("")}
    <tr><th>Registos</th><td>${doc.linhas.length}</td></tr>
  </tbody></table>
  ${legendaHtml()}
  <p class="nota">Documento gerado pelo sistema IGESDF — Licenciamento para instrução processual no SEI.</p>
</section>`;
}

function tabelaHtml(doc: DocumentoTabela) {
  const cabecalho = doc.colunas.map((c) => `<th>${esc(c.cabecalho)}</th>`).join("");
  const corpo = doc.linhas
    .map(
      (linha) =>
        `<tr>${doc.colunas
          .map((c, i) => {
            const valor = linha[i] ?? "";
            const cs = c.situacao ? corSituacao(valor) : null;
            const estilo = cs
              ? ` style="background:#${cs.fundo};color:#${cs.texto};font-weight:600;text-align:center"`
              : "";
            return `<td${estilo}>${esc(valor)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<section class="folha dados">
  <div class="cabecalho-dados"><span>${esc(doc.titulo)}</span><span>${esc(doc.subtitulo ?? "")}</span></div>
  <table class="grade"><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>
</section>`;
}

export function construirHtmlRelatorio(doc: DocumentoTabela) {
  const orientacao = doc.orientacao ?? "landscape";
  const largura = orientacao === "landscape" ? "297mm" : "210mm";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(doc.titulo)}</title>
<style>
  @page { size: A4 ${orientacao}; margin: 14mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #eef0f4; font-family: Arial, Helvetica, sans-serif; color: #1F2937; }
  .folha { width: ${largura}; min-height: ${orientacao === "landscape" ? "210mm" : "297mm"}; margin: 0 auto 8mm; padding: 14mm 12mm; background: #fff; }
  .folha + .folha { break-before: page; }
  .marca { border-bottom: 3px solid #${MARCA.fundo}; padding-bottom: 8px; }
  .marca-nome { font-size: 22pt; font-weight: 800; letter-spacing: .04em; color: #${MARCA.fundo}; }
  .marca-sub { font-size: 9pt; letter-spacing: .18em; text-transform: uppercase; color: #${MARCA.cinza}; }
  h1 { font-size: 20pt; margin: 22mm 0 4px; color: #${MARCA.fundo}; }
  .sub { margin: 0 0 10mm; font-size: 10.5pt; color: #${MARCA.cinza}; }
  table.meta { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.meta th { width: 46mm; text-align: left; background: #${MARCA.faixa}; color: #${MARCA.fundo}; }
  table.meta th, table.meta td { border: .5px solid #${MARCA.linha}; padding: 5px 8px; }
  .legenda { margin-top: 10mm; border: .5px solid #${MARCA.linha}; border-radius: 3px; padding: 8px 10px; }
  .legenda-titulo { font-size: 9pt; font-weight: 700; color: #${MARCA.fundo}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .08em; }
  .legenda-itens { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 9pt; }
  .legenda-item { display: inline-flex; align-items: center; gap: 6px; }
  .legenda-item i { width: 14px; height: 10px; border: 1px solid; border-radius: 2px; display: inline-block; }
  .nota { margin-top: auto; padding-top: 8mm; font-size: 8.5pt; color: #${MARCA.cinza}; }
  .cabecalho-dados { display: flex; justify-content: space-between; font-size: 8.5pt; color: #${MARCA.cinza}; border-bottom: 1px solid #${MARCA.linha}; padding-bottom: 4px; margin-bottom: 6px; }
  table.grade { width: 100%; border-collapse: collapse; font-size: 8pt; }
  table.grade thead { display: table-header-group; }
  table.grade th { background: #${MARCA.fundo}; color: #fff; text-align: left; font-weight: 700; }
  table.grade th, table.grade td { border: .5px solid #${MARCA.linha}; padding: 3px 5px; vertical-align: top; word-break: break-word; }
  table.grade tbody tr:nth-child(even) td { background: #${MARCA.zebra}; }
  table.grade tr { break-inside: avoid; }
  @media print { body { background: #fff; } .folha { margin: 0; padding: 0; width: auto; min-height: 0; } }
</style></head><body>
${capaHtml(doc)}
${tabelaHtml(doc)}
</body></html>`;
}

/** Versão em markdown (capa + legenda + tabela) para o Word. */
export function construirMarkdownRelatorio(doc: DocumentoTabela) {
  const meta = linhasMetadados(doc.meta)
    .map((l) => `- **${l.rotulo}:** ${l.valor}`)
    .join("\n");
  const legenda = SITUACOES_LEGENDA.map((s) => `- ${s.rotulo}`).join("\n");
  const cab = `| ${doc.colunas.map((c) => c.cabecalho).join(" | ")} |`;
  const sep = `| ${doc.colunas.map(() => "---").join(" | ")} |`;
  const corpo = doc.linhas
    .map((l) => `| ${doc.colunas.map((_, i) => (l[i] ?? "").replace(/\|/g, "/")).join(" | ")} |`)
    .join("\n");
  return `## Identificação do documento

${meta}
- **Registos:** ${doc.linhas.length}

## Legenda do semáforo

${legenda}

## ${doc.subtitulo ? doc.subtitulo : "Dados"}

${cab}
${sep}
${corpo}
`;
}
