/**
 * Exportação dos documentos gerados pela IA nos três formatos pedidos:
 * Markdown (texto), Word (.docx editável) e PDF (via impressão do navegador).
 *
 * O markdown produzido pelo assistente é simples (títulos, listas, tabelas em
 * pipe, parágrafos e negrito), por isso a conversão é feita aqui, sem
 * dependências pesadas. O Word e o PDF saem em A4 com margens de 2,5 cm,
 * cabeçalho institucional, numeração de páginas e situações a cores — prontos
 * para juntar ao processo SEI sem retoques.
 */
import { corSituacao, MARCA } from "@/lib/exportar/paleta";

export type Formato = "md" | "docx" | "pdf";

export const FORMATOS: { valor: Formato; rotulo: string; descricao: string }[] = [
  { valor: "pdf", rotulo: "PDF", descricao: "Pronto para imprimir e assinar." },
  { valor: "docx", rotulo: "Word (.docx)", descricao: "Editável antes de juntar ao SEI." },
  { valor: "md", rotulo: "Texto (.md)", descricao: "Ficheiro leve para copiar." },
];

export function nomeFicheiro(titulo: string) {
  return (
    titulo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "documento"
  );
}

function descarregar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function limpar(t: string) {
  return t.replace(/\*\*/g, "").trim();
}

/** Linha de tabela em markdown: `| a | b |`. */
function celulas(linha: string) {
  return linha
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => limpar(c));
}

const SEPARADOR = /^\|?[\s:-]*-{2,}[\s|:-]*$/;

type Bloco =
  | { t: "titulo"; nivel: number; texto: string }
  | { t: "p"; texto: string }
  | { t: "lista"; itens: string[] }
  | { t: "tabela"; cab: string[]; linhas: string[][] };

/** Analisa o markdown simples do assistente numa sequência de blocos. */
function analisar(conteudo: string): Bloco[] {
  const linhas = conteudo.split("\n");
  const blocos: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i].trim();
    if (!l) {
      i += 1;
      continue;
    }
    if (l.startsWith("|") && linhas[i + 1] && SEPARADOR.test(linhas[i + 1].trim())) {
      const cab = celulas(l);
      const corpo: string[][] = [];
      i += 2;
      while (i < linhas.length && linhas[i].trim().startsWith("|")) {
        corpo.push(celulas(linhas[i].trim()));
        i += 1;
      }
      blocos.push({ t: "tabela", cab, linhas: corpo });
      continue;
    }
    const item = /^[-*]\s+(.*)$/.exec(l);
    if (item) {
      const itens: string[] = [];
      while (i < linhas.length) {
        const m = /^[-*]\s+(.*)$/.exec(linhas[i].trim());
        if (!m) break;
        itens.push(limpar(m[1]));
        i += 1;
      }
      blocos.push({ t: "lista", itens });
      continue;
    }
    const titulo = /^(#{1,4})\s+(.*)$/.exec(l);
    if (titulo) {
      blocos.push({ t: "titulo", nivel: titulo[1].length, texto: limpar(titulo[2]) });
      i += 1;
      continue;
    }
    blocos.push({ t: "p", texto: l });
    i += 1;
  }
  return blocos;
}

function celulaHtml(valor: string) {
  const cor = corSituacao(valor);
  const estilo = cor
    ? ` style="background:#${cor.fundo};color:#${cor.texto};font-weight:600;text-align:center"`
    : "";
  return `<td${estilo}>${escapar(valor)}</td>`;
}

function paraHtml(conteudo: string) {
  return analisar(conteudo)
    .map((b) => {
      if (b.t === "titulo") {
        const nivel = Math.min(b.nivel + 1, 5);
        return `<h${nivel}>${escapar(b.texto)}</h${nivel}>`;
      }
      if (b.t === "lista") {
        return `<ul>${b.itens.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>`;
      }
      if (b.t === "tabela") {
        return `<table><thead><tr>${b.cab
          .map((c) => `<th>${escapar(c)}</th>`)
          .join("")}</tr></thead><tbody>${b.linhas
          .map((l) => `<tr>${l.map(celulaHtml).join("")}</tr>`)
          .join("")}</tbody></table>`;
      }
      return `<p>${escapar(b.texto)}</p>`;
    })
    .join("\n");
}

function exportarPdf(titulo: string, conteudo: string) {
  const janela = window.open("", "_blank", "width=900,height=1000");
  if (!janela) throw new Error("O navegador bloqueou a janela de impressão.");
  const data = new Date().toLocaleDateString("pt-BR");
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapar(titulo)}</title>
<style>
  @page { size: A4 portrait; margin: 25mm 20mm 20mm 25mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 11.5pt; line-height: 1.55; color: #111; margin: 0; }
  .cabecalho { border-bottom: 2px solid #${MARCA.fundo}; padding-bottom: 6px; margin-bottom: 14px; }
  .cabecalho .marca { font-family: Arial, sans-serif; font-size: 8.5pt; letter-spacing: .12em; text-transform: uppercase; color: #${MARCA.fundo}; }
  h1 { font-size: 15pt; margin: 4px 0 0; color: #${MARCA.fundo}; }
  h2 { font-size: 13pt; color: #${MARCA.fundo}; margin: 16px 0 6px; break-after: avoid; }
  h3, h4, h5 { font-size: 12pt; margin: 12px 0 4px; break-after: avoid; }
  p { text-align: justify; margin: 0 0 8px; orphans: 3; widows: 3; }
  ul { margin: 0 0 8px 18px; padding: 0; }
  li { margin-bottom: 3px; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 9pt; margin: 8px 0 12px; }
  thead { display: table-header-group; }
  th { background: #${MARCA.fundo}; color: #fff; text-align: left; }
  th, td { border: .5px solid #${MARCA.linha}; padding: 3px 5px; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #${MARCA.zebra}; }
  tr { break-inside: avoid; }
  .rodape { position: fixed; bottom: 6mm; left: 0; right: 0; font-family: Arial, sans-serif; font-size: 7.5pt; color: #${MARCA.cinza}; border-top: .5px solid #${MARCA.linha}; padding-top: 3px; }
</style></head><body>
<div class="cabecalho"><div class="marca">IGESDF · Núcleo de Licenciamento</div><h1>${escapar(titulo)}</h1></div>
${paraHtml(conteudo)}
<div class="rodape">${escapar(titulo)} — emitido em ${data}</div>
</body></html>`);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 400);
}

async function exportarDocx(titulo: string, conteudo: string) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    BorderStyle,
    Header,
    Footer,
    PageNumber,
  } = await import("docx");

  // A4 (11906 × 16838 DXA) com margens de 2,5 cm; largura útil = 9066 DXA.
  const LARGURA_UTIL = 9066;
  const borda = { style: BorderStyle.SINGLE, size: 2, color: MARCA.linha };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };

  const filhos: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: MARCA.fundo, space: 4 } },
      children: [new TextRun({ text: titulo, bold: true, color: MARCA.fundo, size: 30 })],
    }),
  ];

  for (const bloco of analisar(conteudo)) {
    if (bloco.t === "titulo") {
      filhos.push(
        new Paragraph({
          heading: bloco.nivel <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          spacing: { before: 220, after: 100 },
          keepNext: true,
          children: [
            new TextRun({
              text: bloco.texto,
              bold: true,
              color: MARCA.fundo,
              size: bloco.nivel <= 2 ? 26 : 24,
            }),
          ],
        }),
      );
    } else if (bloco.t === "lista") {
      for (const item of bloco.itens) {
        filhos.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [new TextRun(item)],
          }),
        );
      }
    } else if (bloco.t === "tabela") {
      const colunas = Math.max(bloco.cab.length, 1);
      const largura = Math.floor(LARGURA_UTIL / colunas);
      const larguras = Array.from({ length: colunas }, () => largura);
      const celulaWord = (texto: string, cabecalho: boolean) => {
        const cor = cabecalho ? null : corSituacao(texto);
        return new TableCell({
          borders: bordas,
          width: { size: largura, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: {
            type: ShadingType.CLEAR,
            fill: cabecalho ? MARCA.fundo : (cor?.fundo ?? "FFFFFF"),
          },
          children: [
            new Paragraph({
              alignment: cabecalho || cor ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: texto,
                  bold: cabecalho || Boolean(cor),
                  size: 18,
                  color: cabecalho ? "FFFFFF" : (cor?.texto ?? "1F2937"),
                }),
              ],
            }),
          ],
        });
      };
      filhos.push(
        new Table({
          width: { size: larguras.reduce((a, b) => a + b, 0), type: WidthType.DXA },
          columnWidths: larguras,
          rows: [
            new TableRow({
              tableHeader: true,
              children: bloco.cab.map((c) => celulaWord(c, true)),
            }),
            ...bloco.linhas.map(
              (l) =>
                new TableRow({
                  children: Array.from({ length: colunas }, (_, i) =>
                    celulaWord(l[i] ?? "", false),
                  ),
                }),
            ),
          ],
        }),
      );
      filhos.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    } else {
      filhos.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160, line: 300 },
          children: [new TextRun(limpar(bloco.texto))],
        }),
      );
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1418, right: 1134, bottom: 1134, left: 1418 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "IGESDF · NÚCLEO DE LICENCIAMENTO",
                    size: 16,
                    color: MARCA.cinza,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: MARCA.linha, space: 4 },
                },
                children: [
                  new TextRun({
                    text: `${titulo} — pág. `,
                    size: 16,
                    color: MARCA.cinza,
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MARCA.cinza }),
                  new TextRun({ text: "/", size: 16, color: MARCA.cinza }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MARCA.cinza }),
                ],
              }),
            ],
          }),
        },
        children: filhos,
      },
    ],
  });
  descarregar(await Packer.toBlob(doc), `${nomeFicheiro(titulo)}.docx`);
}

export async function exportarDocumento(formato: Formato, titulo: string, conteudo: string) {
  if (formato === "md") {
    descarregar(
      new Blob([`# ${titulo}\n\n${conteudo}`], { type: "text/markdown;charset=utf-8" }),
      `${nomeFicheiro(titulo)}.md`,
    );
    return;
  }
  if (formato === "docx") {
    await exportarDocx(titulo, conteudo);
    return;
  }
  exportarPdf(titulo, conteudo);
}
