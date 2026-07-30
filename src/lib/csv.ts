/**
 * Exportação para planilha. O Excel em português abre CSV assumindo `;` como
 * separador e precisa do BOM para ler acentos corretamente.
 */

export type ColunaCsv<T> = {
  cabecalho: string;
  valor: (linha: T) => string | number | null | undefined;
};

function escapar(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  // Prefixo defensivo: impede que o Excel interprete o conteúdo como fórmula.
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export function paraCsv<T>(linhas: T[], colunas: ColunaCsv<T>[]): string {
  const cabecalho = colunas.map((c) => escapar(c.cabecalho)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => escapar(c.valor(l))).join(";"));
  return ["﻿" + cabecalho, ...corpo].join("\r\n");
}

export function baixarCsv<T>(nomeArquivo: string, linhas: T[], colunas: ColunaCsv<T>[]): void {
  const conteudo = paraCsv(linhas, colunas);
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Sufixo de data para nomes de arquivo: "2026-07-30". */
export function sufixoData(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
