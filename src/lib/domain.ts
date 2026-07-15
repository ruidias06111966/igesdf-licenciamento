// Domínio: mapeamentos de enums e helpers de apresentação
export type Orgao =
  | "VISA" | "CBMDF" | "IBRAM" | "SEOP" | "PCDF" | "SEAGRI" | "SEEDF"
  | "DEFESA_CIVIL" | "CNES" | "ADM_REGIONAL" | "CRM" | "COREN" | "CRF"
  | "CNEN" | "ANVISA" | "JUCIS" | "OUTRO";

export type StatusLicenca =
  | "nao_iniciado" | "em_analise" | "aguardando_orgao" | "vigente" | "a_vencer"
  | "vencida" | "indeferida" | "dispensada" | "pendente_declaracao" | "em_estudo";

export type TipoUnidade = "hospital" | "upa" | "administrativo" | "laboratorio" | "outro";

export const ORGAOS: { value: Orgao; label: string; descricao: string }[] = [
  { value: "VISA", label: "Vigilância Sanitária", descricao: "DIVISA/SES-DF — Certificado de Licenciamento Sanitário" },
  { value: "CBMDF", label: "Corpo de Bombeiros", descricao: "Segurança contra incêndio e pânico (Risco III)" },
  { value: "IBRAM", label: "Brasília Ambiental", descricao: "Licenciamento ambiental + PGRSS" },
  { value: "SEOP", label: "SEOP-DF", descricao: "Proteção da Ordem Urbanística" },
  { value: "DEFESA_CIVIL", label: "Defesa Civil", descricao: "Subsecretaria do Sistema de Defesa Civil" },
  { value: "PCDF", label: "Polícia Civil DF", descricao: "Licenciamento PCDF" },
  { value: "SEAGRI", label: "SEAGRI", descricao: "Agricultura, Abastecimento e Desenvolvimento Rural" },
  { value: "SEEDF", label: "SEEDF", descricao: "Secretaria de Educação DF" },
  { value: "CNES", label: "CNES/DATASUS", descricao: "Cadastro Nacional de Estabelecimentos de Saúde" },
  { value: "ADM_REGIONAL", label: "Adm. Regional", descricao: "Licença de Funcionamento" },
  { value: "ANVISA", label: "ANVISA (AFE)", descricao: "Autorização de Funcionamento (medicamentos controlados)" },
  { value: "CNEN", label: "CNEN", descricao: "Autoridade Nuclear (radiodiagnóstico)" },
  { value: "CRM", label: "CRM-DF", descricao: "Conselho Regional de Medicina" },
  { value: "COREN", label: "COREN-DF", descricao: "Conselho Regional de Enfermagem" },
  { value: "CRF", label: "CRF-DF", descricao: "Conselho Regional de Farmácia" },
  { value: "JUCIS", label: "JUCIS-DF", descricao: "Junta Comercial" },
  { value: "OUTRO", label: "Outro", descricao: "Outro órgão" },
];

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

export const TIPO_UNIDADE_LABEL: Record<TipoUnidade, string> = {
  hospital: "Hospital",
  upa: "UPA",
  administrativo: "Administrativo",
  laboratorio: "Laboratório",
  outro: "Outro",
};

export type Semaforo = "vigente" | "a_vencer_alerta" | "a_vencer_critico" | "vencida" | "dispensada" | "indeferida" | "sem_data" | string;

export function semaforoColor(s: Semaforo): { bg: string; text: string; label: string } {
  switch (s) {
    case "vigente": return { bg: "bg-success/15", text: "text-success", label: "Vigente" };
    case "a_vencer_alerta": return { bg: "bg-warning/15", text: "text-warning-foreground", label: "A vencer (≤90d)" };
    case "a_vencer_critico": return { bg: "bg-destructive/15", text: "text-destructive", label: "Crítico (≤60d)" };
    case "vencida": return { bg: "bg-destructive/25", text: "text-destructive", label: "Vencida" };
    case "dispensada": return { bg: "bg-muted", text: "text-muted-foreground", label: "Dispensada" };
    case "indeferida": return { bg: "bg-destructive/10", text: "text-destructive", label: "Indeferida" };
    default: return { bg: "bg-info/15", text: "text-info", label: STATUS_LABEL[s as StatusLicenca] ?? "Sem data" };
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
