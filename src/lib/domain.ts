// Domínio: mapeamentos de enums, cálculo do semáforo e helpers de apresentação.
import { daysUntil } from "@/lib/dates";
import type { Database } from "@/integrations/supabase/types";

export type Orgao = Database["public"]["Enums"]["orgao_licenciador"];
export type StatusLicenca = Database["public"]["Enums"]["status_licenca"];
export type TipoUnidade = Database["public"]["Enums"]["tipo_unidade"];
export type StatusChecklist = "pendente" | "em_curso" | "concluido" | "nao_aplicavel";

export const ORGAOS: { value: Orgao; label: string; descricao: string }[] = [
  {
    value: "DF_LEGAL",
    label: "DF LEGAL",
    descricao: "Secretaria de Estado de Proteção da Ordem Urbanística do DF",
  },
  { value: "SUSDEC", label: "SUSDEC", descricao: "Subsecretaria do Sistema de Defesa Civil" },
  {
    value: "CBMDF",
    label: "CBM",
    descricao: "Corpo de Bombeiros Militar do DF — segurança contra incêndio e pânico",
  },
  {
    value: "IBRAM",
    label: "IBRAM",
    descricao: "Instituto Brasília Ambiental — licenciamento ambiental + PGRSS",
  },
  {
    value: "VISA",
    label: "VISADF",
    descricao: "Vigilância Sanitária do DF — licenciamento sanitário por CNAE",
  },
  { value: "PCDF", label: "Polícia Civil DF", descricao: "Licenciamento PCDF" },
  {
    value: "SEAGRI",
    label: "SEAGRI",
    descricao: "Secretaria de Agricultura, Abastecimento e Desenvolvimento Rural do DF",
  },
  { value: "SEEDF", label: "SEEDF", descricao: "Secretaria de Estado de Educação do DF" },
  { value: "SEOP", label: "SEOP (legado)", descricao: "Antiga nomenclatura da DF LEGAL" },
  {
    value: "DEFESA_CIVIL",
    label: "Defesa Civil (legado)",
    descricao: "Antiga nomenclatura da SUSDEC",
  },
  {
    value: "CNES",
    label: "CNES/DATASUS",
    descricao: "Cadastro Nacional de Estabelecimentos de Saúde",
  },
  { value: "ADM_REGIONAL", label: "Administração Regional", descricao: "Licença de Funcionamento" },
  {
    value: "ANVISA",
    label: "ANVISA (AFE)",
    descricao: "Autorização de Funcionamento (medicamentos controlados)",
  },
  { value: "CNEN", label: "CNEN", descricao: "Autoridade Nuclear (radiodiagnóstico)" },
  { value: "CRM", label: "CRM-DF", descricao: "Conselho Regional de Medicina" },
  { value: "COREN", label: "COREN-DF", descricao: "Conselho Regional de Enfermagem" },
  { value: "CRF", label: "CRF-DF", descricao: "Conselho Regional de Farmácia" },
  { value: "JUCIS", label: "JUCIS-DF", descricao: "Junta Comercial" },
  { value: "OUTRO", label: "Outro", descricao: "Outro órgão" },
];

const ORGAO_POR_VALOR = new Map(ORGAOS.map((o) => [o.value, o]));

/** Sigla curta do órgão, com fallback para o próprio valor do enum. */
export function orgaoLabel(orgao: string | null | undefined): string {
  if (!orgao) return "—";
  return ORGAO_POR_VALOR.get(orgao as Orgao)?.label ?? orgao;
}

export function orgaoDescricao(orgao: string | null | undefined): string {
  if (!orgao) return "";
  return ORGAO_POR_VALOR.get(orgao as Orgao)?.descricao ?? "";
}

export const CHECKLIST_STATUS_LABEL: Record<StatusChecklist, string> = {
  pendente: "Pendente",
  em_curso: "Em andamento",
  concluido: "Concluído",
  nao_aplicavel: "Não aplicável",
};

export function checklistStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return CHECKLIST_STATUS_LABEL[status as StatusChecklist] ?? status;
}

export const STATUS_LABEL: Record<StatusLicenca, string> = {
  nao_iniciado: "Não iniciado",
  em_analise: "Em análise",
  aguardando_orgao: "Aguardando órgão",
  vigente: "Vigente",
  a_vencer: "A vencer",
  vencida: "Vencida",
  indeferida: "Indeferida",
  dispensada: "Dispensada",
  pendente_declaracao: "Pendente declaração",
  em_estudo: "Em estudo",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABEL[status as StatusLicenca] ?? status;
}

/** Situações que não representam pendência de regularização. */
export const STATUS_REGULARES: StatusLicenca[] = ["vigente", "dispensada"];

/** Situações que contam como processo em aberto junto do órgão. */
export const STATUS_PENDENTES: StatusLicenca[] = [
  "nao_iniciado",
  "em_analise",
  "aguardando_orgao",
  "pendente_declaracao",
  "em_estudo",
];

export const TIPO_UNIDADE_LABEL: Record<TipoUnidade, string> = {
  hospital: "Hospital",
  upa: "UPA",
  administrativo: "Administrativo",
  laboratorio: "Laboratório",
  outro: "Outro",
};

export function tipoUnidadeLabel(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return TIPO_UNIDADE_LABEL[tipo as TipoUnidade] ?? tipo;
}

/**
 * Situação da edificação — a Fase 0 do diagnóstico separa as unidades por aqui,
 * porque unidade nova ou em obra segue outro fluxo (projeto aprovado e
 * Habite-se antes de qualquer licença sanitária).
 */
export const SITUACOES_EDIFICACAO = [
  { value: "operando", label: "Operando" },
  { value: "reforma", label: "Em reforma" },
  { value: "obra", label: "Em obra" },
  { value: "a_construir", label: "A construir" },
  { value: "desativada", label: "Desativada" },
] as const;

export function situacaoEdificacaoLabel(v: string | null | undefined): string {
  if (!v) return "—";
  const match = SITUACOES_EDIFICACAO.find(
    (s) => s.value === v || s.label.toLowerCase() === v.toLowerCase(),
  );
  return match?.label ?? v;
}

export type Semaforo =
  | "vigente"
  | "a_vencer_alerta"
  | "a_vencer_critico"
  | "vencida"
  | "dispensada"
  | "indeferida"
  | "sem_data"
  | string;

/**
 * Mesma regra da view `v_licencas_dashboard`, para que a ficha da unidade e o
 * dossiê nunca discordem do painel. Os limites acompanham a exigência de
 * protocolar a renovação sanitária com até 60 dias de antecedência.
 */
export function calcularSemaforo(licenca: {
  status: string | null;
  data_vencimento: string | null;
}): Semaforo {
  const { status, data_vencimento } = licenca;
  if (status === "dispensada" || status === "indeferida") return status;
  if (!data_vencimento) return status ?? "sem_data";
  const dias = daysUntil(data_vencimento);
  if (dias === null) return status ?? "sem_data";
  if (dias < 0) return "vencida";
  if (dias <= 60) return "a_vencer_critico";
  if (dias <= 90) return "a_vencer_alerta";
  return "vigente";
}

export type SemaforoTone = {
  bg: string;
  text: string;
  dot: string;
  label: string;
  /** Ordem de triagem: menor = mais urgente. */
  peso: number;
};

export function semaforoColor(s: Semaforo): SemaforoTone {
  switch (s) {
    case "vencida":
      return {
        bg: "bg-destructive/20",
        text: "text-destructive",
        dot: "bg-destructive",
        label: "Vencida",
        peso: 0,
      };
    case "a_vencer_critico":
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
        dot: "bg-destructive/70",
        label: "Crítico (≤60d)",
        peso: 1,
      };
    case "a_vencer_alerta":
      return {
        bg: "bg-warning/20",
        text: "text-warning-foreground",
        dot: "bg-warning",
        label: "A vencer (≤90d)",
        peso: 2,
      };
    case "vigente":
      return {
        bg: "bg-success/15",
        text: "text-success",
        dot: "bg-success",
        label: "Vigente",
        peso: 5,
      };
    case "dispensada":
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        dot: "bg-muted-foreground/50",
        label: "Dispensada",
        peso: 6,
      };
    case "indeferida":
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
        dot: "bg-destructive/60",
        label: "Indeferida",
        peso: 3,
      };
    default: {
      const rotulo = statusLabel(s);
      return {
        bg: "bg-info/15",
        text: "text-info",
        dot: "bg-info",
        label: rotulo === "—" ? "Sem data" : rotulo,
        peso: 4,
      };
    }
  }
}

/** Grupos de triagem da Fase 1 (risco imediato / rotina / em implantação). */
export type GrupoRisco = "A" | "B" | "C";

export const GRUPO_RISCO_INFO: Record<
  GrupoRisco,
  { titulo: string; curto: string; descricao: string }
> = {
  A: {
    titulo: "Grupo A — Risco imediato",
    curto: "Risco imediato",
    descricao: "Licenças vencidas ou indeferidas. Exposição sanitária e institucional.",
  },
  B: {
    titulo: "Grupo B — Renovação em curso",
    curto: "Renovação",
    descricao: "Vencem em até 90 dias. A renovação sanitária exige 60 dias de antecedência.",
  },
  C: {
    titulo: "Grupo C — Processos em aberto",
    curto: "Em aberto",
    descricao: "Ainda sem licença emitida: não iniciados, em análise ou aguardando o órgão.",
  },
};

export function grupoRisco(licenca: {
  status: string | null;
  data_vencimento: string | null;
  semaforo?: string | null;
}): GrupoRisco | null {
  const s = licenca.semaforo ?? calcularSemaforo(licenca);
  if (s === "vencida" || s === "indeferida") return "A";
  if (s === "a_vencer_critico" || s === "a_vencer_alerta") return "B";
  if (STATUS_PENDENTES.includes(licenca.status as StatusLicenca)) return "C";
  return null;
}

// Extrai código e rótulo do CNAE a partir do campo `descricao` da licença.
// Formato esperado: "CNAE 8610-1/02 — Pronto-socorro" (ou variantes com "-" simples).
export function parseCnae(descricao: string | null | undefined): {
  codigo: string | null;
  label: string | null;
} {
  if (!descricao) return { codigo: null, label: null };
  const m = descricao.match(/CNAE\s+([0-9]{4}-?[0-9](?:\/[0-9]{2})?)\s*[—\-–]\s*(.+)/i);
  if (m) return { codigo: m[1], label: m[2].trim() };
  const m2 = descricao.match(/([0-9]{4}-?[0-9](?:\/[0-9]{2})?)/);
  if (m2) {
    return {
      codigo: m2[1],
      label:
        descricao
          .replace(m2[1], "")
          .replace(/^[\s—\-–:]+/, "")
          .trim() || null,
    };
  }
  return { codigo: null, label: descricao };
}

// Reexportado para não quebrar os imports de `formatDate` já feitos a partir do domínio.
export { formatDate, formatDateTime, formatDaysLeft, formatMonth, daysUntil } from "@/lib/dates";
