import { z } from "zod";

/**
 * Esquema partilhado da importação de licenças por planilha: o mesmo contrato
 * valida o ficheiro no navegador e a gravação no servidor.
 */
export const ORGAOS_IMPORT = [
  "VISA",
  "CBMDF",
  "IBRAM",
  "SEOP",
  "PCDF",
  "SEAGRI",
  "SEEDF",
  "DEFESA_CIVIL",
  "CNES",
  "ADM_REGIONAL",
  "CRM",
  "COREN",
  "CRF",
  "CNEN",
  "ANVISA",
  "JUCIS",
  "OUTRO",
  "DF_LEGAL",
  "SUSDEC",
] as const;

export const STATUS_IMPORT = [
  "nao_iniciado",
  "em_analise",
  "aguardando_orgao",
  "vigente",
  "a_vencer",
  "vencida",
  "indeferida",
  "dispensada",
  "pendente_declaracao",
  "em_estudo",
] as const;

const data = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
  .optional();

export const linhaImportacaoSchema = z.object({
  unidade: z.string().trim().min(1, "Indique a unidade"),
  orgao: z.enum(ORGAOS_IMPORT),
  descricao: z.string().trim().min(1, "Indique o CNAE ou a descrição"),
  numero: z.string().trim().max(120).optional(),
  processo_sei: z.string().trim().max(120).optional(),
  status: z.enum(STATUS_IMPORT).optional(),
  data_emissao: data,
  data_vencimento: data,
  data_protocolo: data,
  observacoes: z.string().trim().max(2000).optional(),
});

export type LinhaImportacao = z.infer<typeof linhaImportacaoSchema>;

export const linhasImportacaoSchema = z.object({
  linhas: z.array(linhaImportacaoSchema).min(1).max(2000),
  /** `false` = apenas pré-visualizar. */
  aplicar: z.boolean().default(false),
});

/** Colunas aceites no CSV, em minúsculas e sem acentos. */
export const COLUNAS_CSV: Record<string, keyof LinhaImportacao> = {
  unidade: "unidade",
  "nome da unidade": "unidade",
  cnpj: "unidade",
  orgao: "orgao",
  "orgao licenciador": "orgao",
  cnae: "descricao",
  descricao: "descricao",
  numero: "numero",
  "numero da licenca": "numero",
  "processo sei": "processo_sei",
  processo_sei: "processo_sei",
  status: "status",
  estado: "status",
  "data emissao": "data_emissao",
  data_emissao: "data_emissao",
  emissao: "data_emissao",
  "data vencimento": "data_vencimento",
  data_vencimento: "data_vencimento",
  vencimento: "data_vencimento",
  validade: "data_vencimento",
  "data protocolo": "data_protocolo",
  data_protocolo: "data_protocolo",
  protocolo: "data_protocolo",
  observacoes: "observacoes",
  observacao: "observacoes",
};
