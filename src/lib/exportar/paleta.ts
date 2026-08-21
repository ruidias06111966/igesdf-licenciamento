/**
 * Paleta única das exportações (Excel, PDF, Word e impressão do navegador).
 *
 * O ecrã usa tokens do tema, mas um ficheiro entregue no SEI ou aberto no Excel
 * não conhece CSS: precisa de cores fixas. Manter esta tabela num único sítio
 * garante que o vermelho de "vencida" é o mesmo no PDF, na folha de cálculo e
 * no papel.
 *
 * As cores institucionais e do semáforo são reconfiguráveis pelo utilizador na
 * página "Exportações" — os valores escolhidos ficam guardados no navegador e
 * são aplicados aqui, sem precisar de mexer no código.
 */

export type CorExport = { fundo: string; texto: string };

export const CHAVE_TEMA_EXPORT = "igesdf.tema-export";

/** Cores institucionais dos cabeçalhos e faixas de título (valores de origem). */
export const MARCA_PADRAO = {
  fundo: "1F3864", // azul institucional
  texto: "FFFFFF",
  faixa: "D9E2F3",
  linha: "B4C6E7",
  zebra: "F4F6FB",
  cinza: "6B7280",
};

/** Cores institucionais em uso (mutável: recebe as preferências guardadas). */
export const MARCA = { ...MARCA_PADRAO };

const CORES_PADRAO: Record<string, CorExport> = {
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

const CORES: Record<string, CorExport> = { ...CORES_PADRAO };

/** Situações configuráveis pelo utilizador, na ordem apresentada na legenda. */
export const SITUACOES_LEGENDA = [
  { chave: "vigente", rotulo: "Vigente / concluído" },
  { chave: "a_vencer_alerta", rotulo: "A vencer (≤ 90 dias)" },
  { chave: "a_vencer_critico", rotulo: "Crítica (≤ 60 dias)" },
  { chave: "vencida", rotulo: "Vencida / indeferida" },
  { chave: "dispensada", rotulo: "Dispensada / não iniciada" },
  { chave: "em_analise", rotulo: "Em análise / aguardando órgão" },
] as const;

export type TemaExport = {
  marca: Partial<typeof MARCA_PADRAO>;
  cores: Partial<Record<string, CorExport>>;
};

/** Tema atualmente em memória (o que foi aplicado às tabelas acima). */
let temaAtual: TemaExport = { marca: {}, cores: {} };

function normalizarHex(v: string | undefined, alternativa: string) {
  const limpo = String(v ?? "")
    .replace("#", "")
    .toUpperCase();
  return /^[0-9A-F]{6}$/.test(limpo) ? limpo : alternativa;
}

/** Aplica um tema às tabelas em uso (não persiste). */
export function aplicarTemaExport(tema: TemaExport) {
  temaAtual = tema;
  Object.assign(MARCA, MARCA_PADRAO);
  for (const [k, v] of Object.entries(tema.marca ?? {})) {
    const chaveMarca = k as keyof typeof MARCA_PADRAO;
    MARCA[chaveMarca] = normalizarHex(v, MARCA_PADRAO[chaveMarca]);
  }
  for (const k of Object.keys(CORES)) CORES[k] = { ...CORES_PADRAO[k] };
  for (const [k, v] of Object.entries(tema.cores ?? {})) {
    if (!v || !CORES_PADRAO[k]) continue;
    CORES[k] = {
      fundo: normalizarHex(v.fundo, CORES_PADRAO[k].fundo),
      texto: normalizarHex(v.texto, CORES_PADRAO[k].texto),
    };
  }
  // Sinónimos seguem a situação principal.
  CORES.indeferida = { ...CORES.vencida };
  CORES.aguardando_orgao = { ...CORES.em_analise };
  CORES.concluido = { ...CORES.vigente };
  CORES.conferido = { ...CORES.vigente };
  CORES.sem_data = { ...CORES.dispensada };
  CORES.nao_iniciado = { ...CORES.dispensada };
}

export function temaExportAtual(): TemaExport {
  return temaAtual;
}

export function corPadrao(chave: string): CorExport {
  return CORES_PADRAO[chave] ?? { fundo: "E2E3E5", texto: "41464B" };
}

/** Lê o tema guardado no navegador e aplica-o. Idempotente. */
export function carregarTemaExport() {
  if (typeof window === "undefined") return;
  try {
    const bruto = localStorage.getItem(CHAVE_TEMA_EXPORT);
    aplicarTemaExport(bruto ? (JSON.parse(bruto) as TemaExport) : { marca: {}, cores: {} });
  } catch {
    aplicarTemaExport({ marca: {}, cores: {} });
  }
}

/** Guarda e aplica o tema escolhido pelo utilizador. */
export function guardarTemaExport(tema: TemaExport) {
  aplicarTemaExport(tema);
  try {
    localStorage.setItem(CHAVE_TEMA_EXPORT, JSON.stringify(tema));
  } catch {
    // Sem persistência (modo privado); a sessão atual continua com as cores.
  }
}

if (typeof window !== "undefined") carregarTemaExport();

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
