import { z } from "zod";

/**
 * O compilador do TanStack Start remove constantes do topo dos ficheiros
 * `*.functions.ts` ao dividir o módulo de servidor. O esquema vive aqui para
 * continuar disponível dentro dos handlers.
 */
export const orgaoSchema = z.object({
  id: z.string().uuid().optional(),
  sigla: z.string().trim().min(2).max(30),
  nome: z.string().trim().min(2).max(300),
  categoria: z.string().trim().max(150).nullable().optional(),
  site: z.string().trim().max(300).nullable().optional(),
  telefone: z.string().trim().max(60).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  endereco: z.string().trim().max(400).nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  ativo: z.boolean().optional(),
});

export const idSchema = z.object({ id: z.string().uuid() });
