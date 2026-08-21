/**
 * Exportação do despacho em PDF, pronta para anexar no SEI.
 *
 * O PDF é desenhado a partir dos blocos do documento (texto vetorial,
 * pesquisável e selecionável), e não a partir de uma captura do ecrã: o SEI
 * arquiva o ficheiro e uma imagem rasterizada ficaria ilegível na impressão e
 * inútil para pesquisa. Margens A4 de 2,5 cm, serifa e numeração de páginas,
 * como os restantes documentos oficiais do processo.
 */
import type { Bloco } from "@/lib/despacho/nucleo";

const A4 = { largura: 210, altura: 297 };
const MARGEM = { esq: 25, dir: 20, topo: 25, base: 20 };
const LARGURA_UTIL = A4.largura - MARGEM.esq - MARGEM.dir;

function limpar(t: string) {
  return t.replace(/\*\*/g, "");
}

export type OpcoesPdf = {
  /** Nome do ficheiro, sem extensão. */
  ficheiro: string;
  /** Linha de rodapé: unidade, processo SEI, data. */
  rodape?: string;
};

export async function exportarDespachoPdf(blocos: Bloco[], opcoes: OpcoesPdf) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = MARGEM.topo;

  const novaPagina = () => {
    doc.addPage();
    y = MARGEM.topo;
  };
  const garantir = (altura: number) => {
    if (y + altura > A4.altura - MARGEM.base) novaPagina();
  };

  const paragrafo = (texto: string, opts: { negrito?: boolean; tamanho?: number } = {}) => {
    doc.setFont("times", opts.negrito ? "bold" : "normal");
    doc.setFontSize(opts.tamanho ?? 11);
    const linhas = doc.splitTextToSize(limpar(texto), LARGURA_UTIL) as string[];
    const alturaLinha = (opts.tamanho ?? 11) * 0.55;
    for (const linha of linhas) {
      garantir(alturaLinha);
      doc.text(linha, MARGEM.esq, y, { align: "justify", maxWidth: LARGURA_UTIL });
      y += alturaLinha;
    }
    y += 2;
  };

  for (const bloco of blocos) {
    switch (bloco.t) {
      case "titulo":
        y += 2;
        paragrafo(bloco.texto.toUpperCase(), { negrito: true, tamanho: 12 });
        break;
      case "p":
        paragrafo(bloco.texto);
        break;
      case "lista":
        for (const item of bloco.itens) {
          doc.setFont("times", "normal");
          doc.setFontSize(11);
          const linhas = doc.splitTextToSize(`•  ${limpar(item)}`, LARGURA_UTIL - 5) as string[];
          for (const linha of linhas) {
            garantir(6);
            doc.text(linha, MARGEM.esq + 5, y);
            y += 5.5;
          }
        }
        y += 2;
        break;
      case "tabela":
        y = desenharTabela(doc, bloco.cab, bloco.linhas, y, garantir, novaPagina);
        break;
      case "assinatura": {
        garantir(40);
        y += 6;
        paragrafo(bloco.local);
        y += 12;
        let x = MARGEM.esq;
        const largura = Math.min(75, LARGURA_UTIL / Math.max(bloco.linhas.length, 1) - 5);
        for (const a of bloco.linhas) {
          doc.setDrawColor(60);
          doc.line(x, y, x + largura, y);
          doc.setFont("times", "bold");
          doc.setFontSize(10.5);
          doc.text(a.nome, x, y + 5, { maxWidth: largura });
          doc.setFont("times", "normal");
          doc.setFontSize(9);
          doc.text(doc.splitTextToSize(a.cargo, largura) as string[], x, y + 9.5);
          x += largura + 10;
        }
        y += 22;
        break;
      }
    }
  }

  // Rodapé com identificação e numeração, em todas as páginas.
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    if (opcoes.rodape) {
      doc.text(opcoes.rodape, MARGEM.esq, A4.altura - 12, { maxWidth: LARGURA_UTIL - 25 });
    }
    doc.text(`${p}/${total}`, A4.largura - MARGEM.dir, A4.altura - 12, { align: "right" });
    doc.setTextColor(0);
  }

  doc.save(`${opcoes.ficheiro}.pdf`);
}

type Doc = Awaited<ReturnType<typeof importarJsPdf>>;
async function importarJsPdf() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF();
}

function desenharTabela(
  doc: Doc,
  cabecalho: string[],
  linhas: string[][],
  yInicial: number,
  garantir: (altura: number) => void,
  novaPagina: () => void,
): number {
  const colunas = cabecalho.length;
  const larguraCol = LARGURA_UTIL / colunas;
  let y = yInicial + 2;

  const desenharCabecalho = () => {
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    let x = MARGEM.esq;
    for (const c of cabecalho) {
      doc.text(doc.splitTextToSize(c, larguraCol - 2) as string[], x + 1, y + 4);
      x += larguraCol;
    }
    doc.setDrawColor(120);
    doc.line(MARGEM.esq, y + 6, MARGEM.esq + LARGURA_UTIL, y + 6);
    y += 8;
  };

  garantir(20);
  desenharCabecalho();

  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  for (const linha of linhas) {
    const celulas = linha.map(
      (c) => doc.splitTextToSize(String(c ?? ""), larguraCol - 2) as string[],
    );
    const altura = Math.max(...celulas.map((c) => c.length)) * 3.8 + 2.5;
    if (y + altura > A4.altura - MARGEM.base) {
      novaPagina();
      y = MARGEM.topo;
      desenharCabecalho();
      doc.setFont("times", "normal");
      doc.setFontSize(8.5);
    }
    let x = MARGEM.esq;
    for (const celula of celulas) {
      doc.text(celula, x + 1, y + 3);
      x += larguraCol;
    }
    y += altura;
    doc.setDrawColor(215);
    doc.line(MARGEM.esq, y - 1, MARGEM.esq + LARGURA_UTIL, y - 1);
  }
  return y + 3;
}
