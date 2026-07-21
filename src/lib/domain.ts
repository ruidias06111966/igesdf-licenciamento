// Domínio: mapeamentos de enums e helpers de apresentação
export type Orgao =
  | "VISA" | "CBMDF" | "IBRAM" | "SEOP" | "DF_LEGAL" | "SUSDEC" | "PCDF" | "SEAGRI" | "SEEDF"
  | "DEFESA_CIVIL" | "CNES" | "ADM_REGIONAL" | "CRM" | "COREN" | "CRF"
  | "CNEN" | "ANVISA" | "JUCIS" | "OUTRO";

export type StatusLicenca =
  | "nao_iniciado" | "em_analise" | "aguardando_orgao" | "vigente" | "a_vencer"
  | "vencida" | "indeferida" | "dispensada" | "pendente_declaracao" | "em_estudo";

export type TipoUnidade = "hospital" | "upa" | "administrativo" | "laboratorio" | "outro";

export const ORGAOS: { value: Orgao; label: string; descricao: string }[] = [
  { value: "DF_LEGAL", label: "DF LEGAL", descricao: "Secretaria de Estado de Proteção da Ordem Urbanística do DF" },
  { value: "SUSDEC", label: "SUSDEC", descricao: "Subsecretaria do Sistema de Defesa Civil" },
  { value: "CBMDF", label: "CBM", descricao: "Corpo de Bombeiros Militar do DF — segurança contra incêndio e pânico" },
  { value: "IBRAM", label: "IBRAM", descricao: "Instituto Brasília Ambiental — licenciamento ambiental + PGRSS" },
  { value: "VISA", label: "VISADF", descricao: "Vigilância Sanitária do DF — licenciamento sanitário por CNAE" },
  { value: "PCDF", label: "Polícia Civil DF", descricao: "Licenciamento PCDF" },
  { value: "SEAGRI", label: "SEAGRI", descricao: "Secretaria de Agricultura, Abastecimento e Desenvolvimento Rural do DF" },
  { value: "SEEDF", label: "SEEDF", descricao: "Secretaria de Estado de Educação do DF" },
  { value: "SEOP", label: "SEOP (legado)", descricao: "Antiga nomenclatura da DF LEGAL" },
  { value: "DEFESA_CIVIL", label: "Defesa Civil (legado)", descricao: "Antiga nomenclatura da SUSDEC" },
  { value: "CNES", label: "CNES/DATASUS", descricao: "Cadastro Nacional de Estabelecimentos de Saúde" },
  { value: "ADM_REGIONAL", label: "Administração Regional", descricao: "Licença de Funcionamento" },
  { value: "ANVISA", label: "ANVISA (AFE)", descricao: "Autorização de Funcionamento (medicamentos controlados)" },
  { value: "CNEN", label: "CNEN", descricao: "Autoridade Nuclear (radiodiagnóstico)" },
  { value: "CRM", label: "CRM-DF", descricao: "Conselho Regional de Medicina" },
  { value: "COREN", label: "COREN-DF", descricao: "Conselho Regional de Enfermagem" },
  { value: "CRF", label: "CRF-DF", descricao: "Conselho Regional de Farmácia" },
  { value: "JUCIS", label: "JUCIS-DF", descricao: "Junta Comercial" },
  { value: "OUTRO", label: "Outro", descricao: "Outro órgão" },
];

export const CHECKLIST_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_curso: "Em curso",
  concluido: "Concluído",
  nao_aplicavel: "Não aplicável",
};

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
