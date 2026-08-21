import { z } from "zod";

/**
 * Esquemas e listas da biblioteca de modelos.
 *
 * Ficam fora de `modelos.functions.ts` porque o compilador do TanStack Start
 * remove constantes do topo dos ficheiros `*.functions.ts` ao dividir o módulo
 * de servidor — e porque a interface usa exatamente as mesmas listas.
 */
export const TIPOS_MODELO = [
  ["despacho", "Despacho"],
  ["oficio", "Ofício"],
  ["relatorio", "Relatório"],
  ["memorando", "Memorando"],
  ["checklist", "Checklist"],
  ["parecer", "Parecer"],
  ["outro", "Outro"],
] as const;

export type TipoModelo = (typeof TIPOS_MODELO)[number][0];

export const ORGAO_VALUES = [
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

export const TIPOS_UNIDADE_MODELO = [
  "hospital",
  "upa",
  "administrativo",
  "laboratorio",
  "outro",
] as const;

export const modeloSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(3).max(200),
  tipo: z.enum(TIPOS_MODELO.map((t) => t[0]) as unknown as [TipoModelo, ...TipoModelo[]]),
  conteudo: z.string().trim().min(1).max(200_000),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  orgao: z.enum(ORGAO_VALUES).nullable().optional(),
  tipo_unidade: z.enum(TIPOS_UNIDADE_MODELO).nullable().optional(),
  unidade_id: z.string().uuid().nullable().optional(),
  processo_id: z.string().uuid().nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  comentario_versao: z.string().trim().max(300).nullable().optional(),
});
