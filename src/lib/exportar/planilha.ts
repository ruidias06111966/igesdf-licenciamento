/**
 * Exportação para Excel (.xlsx) com apresentação profissional.
 *
 * O CSV continua disponível para quem quer o dado cru, mas não guarda cores nem
 * larguras: para relatórios entregues a terceiros usamos aqui uma folha com
 * faixa de título, cabeçalho institucional, filtros automáticos, painéis
 * congelados, zebra e as situações destacadas com a mesma paleta do PDF.
 */
import type { ColunaCsv } from "@/lib/csv";
import { corSituacao, MARCA } from "@/lib/exportar/paleta";

export type OpcoesPlanilha = {
  /** Título apresentado na primeira linha da folha. */
  titulo: string;
  /** Linha de contexto: filtros aplicados, período, total de registos. */
  subtitulo?: string;
  /** Nome do separador da folha. */
  folha?: string;
};

const BORDA = { style: "thin", color: { rgb: "D0D5DD" } } as const;
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };

function texto(valor: string | number | null | undefined) {
  if (valor === null || valor === undefined) return "";
  return typeof valor === "number" ? valor : String(valor);
}

export async function baixarPlanilha<T>(
  nomeArquivo: string,
  linhas: T[],
  colunas: ColunaCsv<T>[],
  opcoes: OpcoesPlanilha,
) {
  const XLSX = await import("xlsx-js-style");

  const larguraTotal = colunas.length;
  const matriz: unknown[][] = [
    [opcoes.titulo],
    [opcoes.subtitulo ?? `Gerado em ${new Date().toLocaleString("pt-BR")}`],
    [],
    colunas.map((c) => c.cabecalho),
    ...linhas.map((l) => colunas.map((c) => texto(c.valor(l)))),
  ];

  const folha = XLSX.utils.aoa_to_sheet(matriz);

  const celula = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });
  const estilo = (r: number, c: number, s: Record<string, unknown>) => {
    const ref = celula(r, c);
    const atual = (folha as Record<string, { v?: unknown; t?: string; s?: unknown }>)[ref];
    if (!atual) (folha as Record<string, unknown>)[ref] = { v: "", t: "s", s };
    else atual.s = s;
  };

  // Faixa de título e subtítulo.
  estilo(0, 0, {
    font: { name: "Arial", sz: 14, bold: true, color: { rgb: MARCA.texto } },
    fill: { patternType: "solid", fgColor: { rgb: MARCA.fundo } },
    alignment: { vertical: "center", horizontal: "left", indent: 1 },
  });
  estilo(1, 0, {
    font: { name: "Arial", sz: 9, italic: true, color: { rgb: MARCA.cinza } },
    alignment: { vertical: "center", horizontal: "left", indent: 1 },
  });
  for (let c = 1; c < larguraTotal; c += 1) {
    estilo(0, c, { fill: { patternType: "solid", fgColor: { rgb: MARCA.fundo } } });
  }
  folha["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(larguraTotal - 1, 0) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(larguraTotal - 1, 0) } },
  ];

  // Cabeçalho da tabela.
  colunas.forEach((_, c) => {
    estilo(3, c, {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: MARCA.texto } },
      fill: { patternType: "solid", fgColor: { rgb: MARCA.fundo } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: BORDAS,
    });
  });

  // Corpo: zebra + destaque de situação.
  linhas.forEach((linha, i) => {
    const r = 4 + i;
    colunas.forEach((coluna, c) => {
      const valor = texto(coluna.valor(linha));
      const cor = coluna.situacao ? corSituacao(String(valor)) : null;
      estilo(r, c, {
        font: {
          name: "Arial",
          sz: 10,
          bold: Boolean(cor),
          color: { rgb: cor ? cor.texto : "1F2937" },
        },
        fill: {
          patternType: "solid",
          fgColor: { rgb: cor ? cor.fundo : i % 2 ? MARCA.zebra : "FFFFFF" },
        },
        alignment: { vertical: "top", wrapText: true, horizontal: cor ? "center" : "left" },
        border: BORDAS,
      });
    });
  });

  folha["!cols"] = colunas.map((c) => ({
    wch: c.largura ?? Math.min(46, Math.max(12, c.cabecalho.length + 6)),
  }));
  folha["!rows"] = [{ hpt: 26 }, { hpt: 16 }, { hpt: 6 }, { hpt: 24 }];
  folha["!freeze"] = { xSplit: 0, ySplit: 4 };
  folha["!autofilter"] = {
    ref: XLSX.utils.encode_range(
      { r: 3, c: 0 },
      { r: 3 + linhas.length, c: Math.max(larguraTotal - 1, 0) },
    ),
  };
  // Impressão: A4 paisagem, ajustado à largura da página, cabeçalho repetido.
  (folha as Record<string, unknown>)["!margins"] = {
    left: 0.4,
    right: 0.4,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };
  (folha as Record<string, unknown>)["!printHeader"] = [4, 4];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, folha, (opcoes.folha ?? "Relatório").slice(0, 31));
  const wb = livro as unknown as { Workbook?: Record<string, unknown> };
  wb.Workbook = {
    ...(wb.Workbook ?? {}),
    Views: [{ RTL: false }],
  };

  XLSX.writeFile(livro, nomeArquivo.endsWith(".xlsx") ? nomeArquivo : `${nomeArquivo}.xlsx`, {
    bookType: "xlsx",
    compression: true,
  });
}
