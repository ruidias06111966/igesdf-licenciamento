/**
 * Paleta única das exportações (Excel, PDF, Word e impressão do navegador).
 *
 * O ecrã usa tokens do tema, mas um ficheiro entregue no SEI ou aberto no Excel
 * não conhece CSS: precisa de cores fixas. Manter esta tabela num único sítio
 * garante que o vermelho de "vencida" é o mesmo no PDF, na folha de cálculo e
 * no papel.
 */

export type CorExport = { fundo: string; texto: string };

/** Cores institucionais dos cabeçalhos e faixas de título. */
export const MARCA = {
  fundo: "1F3864", // azul institucional
  texto: "FFFFFF",
  faixa: "D9E2F3",
  linha: "B4C6E7",
  zebra: "F4F6FB",
  cinza: "6B7280",
};

const CORES: Record<string, CorExport> = {
  vencida: { fundo: "F8D7DA", texto: "842029" },
  indeferida: { fundo: "F8D7DA", texto: "842029" },
  a_vencer_critico: { fundo: "FBE0C8", texto: "8A4B08" },
  a_vencer_alerta: { fundo: "FFF3CD", texto: "7A5B00" },
  vigente: { fundo: "D1E7DD", texto: "0F5132" },
  em_analise: { fundo: "CFE2FF", texto: "084298" },
  aguardando_orgao: { fundo: "CFE2FF", texto: "084298" },
  em_estudo: { fundo: "E2E3E5", texto: "41464B" },
  pendente_declaracao: { fundo: "FFF3CD", texto: "7A5B00" },
  nao_iniciado: { fundo: "E2E3E5", texto: "41464B" },
  dispensada: { fundo: "E2E3E5", texto: "41464B" },
  sem_data: { fundo: "E2E3E5", texto: "41464B" },
  concluido: { fundo: "D1E7DD", texto: "0F5132" },
  conferido: { fundo: "D1E7DD", texto: "0F5132" },
  pendente: { fundo: "FFF3CD", texto: "7A5B00" },
  criar: { fundo: "D1E7DD", texto: "0F5132" },
  atualizar: { fundo: "CFE2FF", texto: "084298" },
  erro: { fundo: "F8D7DA", texto: "842029" },
  ignorar: { fundo: "E2E3E5", texto: "41464B" },
};

/** Normaliza rótulos ("A vencer (≤90d)", "Vencida"…) para a chave da paleta. */
function chave(valor: string): string {
  const v = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (CORES[v.replace(/[\s-]+/g, "_")]) return v.replace(/[\s-]+/g, "_");
  if (v.includes("vencid")) return "vencida";
  if (v.includes("indeferid")) return "indeferida";
  if (v.includes("critico") || v.includes("60d")) return "a_vencer_critico";
  if (v.includes("vencer")) return "a_vencer_alerta";
  if (v.includes("vigente") || v.includes("conclu") || v.includes("conferid")) return "vigente";
  if (v.includes("analise") || v.includes("aguardando")) return "em_analise";
  if (v.includes("dispensad")) return "dispensada";
  if (v.includes("pendente")) return "pendente";
  return "";
}

/** Cor de fundo/texto para uma situação; `null` quando não há correspondência. */
export function corSituacao(valor: string | null | undefined): CorExport | null {
  if (!valor) return null;
  const k = chave(String(valor));
  return k ? (CORES[k] ?? null) : null;
}
