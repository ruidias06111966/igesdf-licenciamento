import { z } from "zod";
import { CAMPOS_LICENCA } from "@/lib/certificado";

/**
 * Esquemas de validação da aplicação do certificado.
 *
 * Vivem fora do ficheiro de funções de servidor: esse ficheiro só pode conter
 * as declarações das funções, sob pena de o empacotador remover o que estiver
 * ao lado delas.
 */
export const STATUS = [
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

export const ORGAO = [
  "VISA",
  "CBMDF",
  "IBRAM",
  "SEOP",
  "DF_LEGAL",
  "SUSDEC",
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
] as const;

const DATA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const linhaAplicar = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("cnae_novo"),
    codigo: z.string().trim().min(3).max(30),
    descricao: z.string().trim().min(2).max(300),
  }),
  z.object({
    tipo: z.literal("licenca_nova"),
    orgao: z.enum(ORGAO),
    descricao: z.string().trim().max(200),
    valores: z.object({
      status: z.enum(STATUS),
      numero: z.string().trim().max(80).nullable().optional(),
      processo_sei: z.string().trim().max(60).nullable().optional(),
      data_emissao: DATA.optional(),
      data_vencimento: DATA.optional(),
    }),
    observacoes: z.string().trim().max(2000).nullable().optional(),
  }),
  z.object({
    tipo: z.literal("licenca_alterada"),
    licenca_id: z.string().uuid(),
    campos: z
      .array(
        z.object({
          campo: z.enum(CAMPOS_LICENCA),
          depois: z.string().max(200).nullable(),
        }),
      )
      .min(1),
  }),
]);
