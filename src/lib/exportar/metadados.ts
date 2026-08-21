/**
 * Nome padronizado e metadados de arquivo dos ficheiros exportados.
 *
 * Quem junta o documento ao SEI precisa de identificar, só pelo nome e pela
 * capa, de que competência, unidade, órgão e processo se trata. Por isso o
 * nome segue sempre o mesmo padrão e a capa repete os mesmos campos.
 */

export type MetaExport = {
  /** Competência de referência (ex.: "2026-08" ou "Agosto/2026"). */
  competencia?: string | null;
  /** Unidade a que o relatório se refere; "Rede IGESDF" quando é global. */
  unidade?: string | null;
  /** Órgão licenciador filtrado, quando existir. */
  orgao?: string | null;
  /** Número do processo SEI, quando existir. */
  processo?: string | null;
  /** Protocolo/documento SEI, quando existir. */
  protocolo?: string | null;
  /** Observação livre incluída na capa. */
  observacao?: string | null;
};

const ORGAO = "IGESDF";
const AREA = "NUCON";

export function competenciaAtual(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function carimboData(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Converte um texto livre em fragmento seguro para nome de ficheiro. */
export function fatia(valor: string | null | undefined, max = 28) {
  if (!valor) return "";
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

/**
 * Nome padronizado:
 * `IGESDF-NUCON_Licencas_UPA-Gama_SUSDEC_2026-08_SEI-00060-000123_20260821-1043`
 */
export function nomePadronizado(modulo: string, meta: MetaExport = {}, extensao?: string) {
  const partes = [
    `${ORGAO}-${AREA}`,
    fatia(modulo, 32) || "Relatorio",
    fatia(meta.unidade, 28),
    fatia(meta.orgao, 20),
    fatia(meta.competencia ?? competenciaAtual(), 16),
    meta.processo ? `SEI-${fatia(meta.processo, 24)}` : "",
    carimboData(),
  ].filter(Boolean);
  const base = partes.join("_");
  return extensao ? `${base}.${extensao.replace(/^\./, "")}` : base;
}

/** Pares chave/valor da capa e das propriedades do ficheiro. */
export function linhasMetadados(meta: MetaExport = {}): { rotulo: string; valor: string }[] {
  const linhas: { rotulo: string; valor: string }[] = [
    { rotulo: "Órgão emissor", valor: "IGESDF — Núcleo de Licenciamento (NUCON)" },
    { rotulo: "Competência", valor: meta.competencia ?? competenciaAtual() },
    { rotulo: "Unidade", valor: meta.unidade ?? "Rede IGESDF (todas as unidades)" },
    { rotulo: "Órgão licenciador", valor: meta.orgao ?? "Todos" },
  ];
  if (meta.processo) linhas.push({ rotulo: "Processo SEI", valor: meta.processo });
  if (meta.protocolo) linhas.push({ rotulo: "Protocolo/documento SEI", valor: meta.protocolo });
  if (meta.observacao) linhas.push({ rotulo: "Observação", valor: meta.observacao });
  linhas.push({ rotulo: "Emitido em", valor: new Date().toLocaleString("pt-BR") });
  return linhas;
}
