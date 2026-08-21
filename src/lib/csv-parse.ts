/**
 * Leitura de CSV exportado do Excel em português: separador `;` (ou `,`),
 * aspas duplas com escape `""`, BOM no início e quebras de linha dentro de
 * células. Um `split(";")` simples parte as observações a meio.
 */
export function detetarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/)[0] ?? "";
  const pontoVirgula = (primeira.match(/;/g) ?? []).length;
  const virgula = (primeira.match(/,/g) ?? []).length;
  return pontoVirgula >= virgula ? ";" : ",";
}

export function parseCsv(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, "");
  const sep = detetarSeparador(limpo);
  const linhas: string[][] = [];
  let celula = "";
  let linha: string[] = [];
  let entreAspas = false;

  for (let i = 0; i < limpo.length; i += 1) {
    const c = limpo[i];
    if (entreAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          celula += '"';
          i += 1;
        } else entreAspas = false;
      } else celula += c;
      continue;
    }
    if (c === '"') {
      entreAspas = true;
      continue;
    }
    if (c === sep) {
      linha.push(celula);
      celula = "";
      continue;
    }
    if (c === "\n") {
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
      continue;
    }
    if (c === "\r") continue;
    celula += c;
  }
  if (celula !== "" || linha.length > 0) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

export function normalizarCabecalho(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Converte datas 31/12/2026 ou 2026-12-31 para ISO. */
export function dataIso(valor: string): string | undefined {
  const t = valor.trim();
  if (!t) return undefined;
  const br = t.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return t;
}
