/**
 * Apoio ao quadro de CNPJ / CNES / código SOULMV das unidades.
 *
 * Os dados vivem agora na tabela `unidades` (editáveis pelo sistema); aqui
 * ficam só as raízes de CNPJ, os rótulos e as funções de formatação.
 */
import type { Unidade } from "@/lib/rows";

export const RAIZ_IGESDF = "28.481.233";
export const RAIZ_IGESDF_NUM = "28481233";
export const RAIZ_SES = "00.394.700";
export const RAIZ_SES_NUM = "00394700";

export type CategoriaCnpj = "hospital" | "upa" | "apoio";
export type TitularCnes = "proprio" | "ses" | "sem" | "pendente";

export const ROTULO_TITULAR: Record<TitularCnes, string> = {
  proprio: "CNPJ IGESDF",
  ses: "CNPJ SES-DF",
  sem: "não se aplica",
  pendente: "a confirmar",
};

export const ROTULO_CATEGORIA: Record<CategoriaCnpj, string> = {
  hospital: "Hospital",
  upa: "UPA",
  apoio: "Apoio",
};

export const CATEGORIAS_CNPJ = Object.entries(ROTULO_CATEGORIA) as [CategoriaCnpj, string][];
export const TITULARES_CNES = Object.entries(ROTULO_TITULAR) as [TitularCnes, string][];

export const categoriaDe = (u: Unidade): CategoriaCnpj =>
  (u.categoria_cnpj as CategoriaCnpj) ?? "apoio";
export const titularDe = (u: Unidade): TitularCnes => (u.titular_cnes as TitularCnes) ?? "sem";

/** Sufixo "0001-72" a partir do CNPJ gravado ou do nº IGES. */
export function sufixoIges(u: Unidade): string | null {
  const digitos = (u.cnpj ?? "").replace(/\D/g, "");
  if (digitos.length === 14) return `${digitos.slice(8, 12)}-${digitos.slice(12)}`;
  return null;
}

export const cnpjFormatado = (u: Unidade) => {
  const suf = sufixoIges(u);
  return suf ? `${RAIZ_IGESDF}/${suf}` : (u.cnpj ?? "");
};
export const cnpjDigitos = (u: Unidade) => (u.cnpj ?? "").replace(/\D/g, "");
export const sesFormatado = (suf: string | null) => (suf ? `${RAIZ_SES}/${suf}` : null);
export const sesDigitos = (suf: string | null) =>
  suf ? RAIZ_SES_NUM + suf.replace(/\D/g, "") : null;

/** dd/mm/aaaa a partir da data ISO guardada. */
export function inicioFormatado(u: Unidade): string {
  if (!u.inicio_atividade) return "—";
  const [a, m, d] = u.inicio_atividade.split("-");
  return `${d}/${m}/${a}`;
}

/** Copia texto para a área de transferência, com alternativa para navegadores antigos. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
