/**
 * Exportação dos documentos gerados pela IA nos três formatos pedidos:
 * Markdown (texto), Word (.docx editável) e PDF (via impressão do navegador).
 *
 * O markdown produzido pelo assistente é simples (títulos, listas, parágrafos
 * e negrito), por isso a conversão é feita aqui, sem dependências pesadas.
 */

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

/** Converte o markdown simples do assistente em HTML para impressão. */
function paraHtml(conteudo: string) {
  const linhas = conteudo.split("\n");
  const partes: string[] = [];
  let lista = false;
  for (const linha of linhas) {
    const l = linha.trim();
    const item = /^[-*]\s+(.*)$/.exec(l);
    if (item) {
      if (!lista) {
        partes.push("<ul>");
        lista = true;
      }
      partes.push(`<li>${escapar(item[1])}</li>`);
      continue;
    }
    if (lista) {
      partes.push("</ul>");
      lista = false;
    }
    const titulo = /^(#{1,4})\s+(.*)$/.exec(l);
    if (titulo) {
      const nivel = titulo[1].length + 1;
      partes.push(`<h${nivel}>${escapar(titulo[2])}</h${nivel}>`);
    } else if (l) {
      partes.push(`<p>${escapar(l)}</p>`);
    }
  }
  if (lista) partes.push("</ul>");
  return partes.join("\n");
}

function exportarPdf(titulo: string, conteudo: string) {
  const janela = window.open("", "_blank", "width=900,height=1000");
  if (!janela) throw new Error("O navegador bloqueou a janela de impressão.");
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapar(titulo)}</title>
<style>
  @page { size: A4 portrait; margin: 20mm; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 12pt; line-height: 1.6; color: #111; }
  h1 { font-size: 16pt; } h2 { font-size: 14pt; } h3, h4, h5 { font-size: 12.5pt; }
  li, p { break-inside: avoid; }
</style></head><body><h1>${escapar(titulo)}</h1>${paraHtml(conteudo)}</body></html>`);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 400);
}

async function exportarDocx(titulo: string, conteudo: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const paragrafos = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(titulo)] }),
  ];

  for (const linha of conteudo.split("\n")) {
    const l = linha.trim();
    if (!l) continue;
    const item = /^[-*]\s+(.*)$/.exec(l);
    const cabecalho = /^(#{1,4})\s+(.*)$/.exec(l);
    const limpar = (t: string) => t.replace(/\*\*/g, "");
    if (item) {
      paragrafos.push(
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun(limpar(item[1]))] }),
      );
    } else if (cabecalho) {
      paragrafos.push(
        new Paragraph({
          heading: cabecalho[1].length <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          children: [new TextRun(limpar(cabecalho[2]))],
        }),
      );
    } else {
      paragrafos.push(
        new Paragraph({ spacing: { after: 160 }, children: [new TextRun(limpar(l))] }),
      );
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    sections: [{ children: paragrafos }],
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
