import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAcesso } from "@/lib/acesso-middleware";
import { vaziosParaNulo } from "@/lib/sanitize";

const ORGAO = z.enum([
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
]);

/** Lista os processos com a unidade e o resumo do checklist. */
export const listProcessos = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .handler(async ({ context }) => {
    const [proc, itens] = await Promise.all([
      context.supabase
        .from("processos_sei")
        .select("*, unidades(id, nome, tipo)")
        .eq("ativo", true)
        .order("created_at", { ascending: false }),
      context.supabase.from("processo_itens").select("processo_id, situacao, obrigatorio"),
    ]);
    if (proc.error) throw proc.error;
    if (itens.error) throw itens.error;
    const resumo = new Map<string, { total: number; concluidos: number; pendentes: number }>();
    for (const i of itens.data ?? []) {
      const atual = resumo.get(i.processo_id) ?? { total: 0, concluidos: 0, pendentes: 0 };
      atual.total += 1;
      if (i.situacao === "entregue" || i.situacao === "dispensado") atual.concluidos += 1;
      else atual.pendentes += 1;
      resumo.set(i.processo_id, atual);
    }
    return (proc.data ?? []).map((p) => ({
      ...p,
      resumo: resumo.get(p.id) ?? { total: 0, concluidos: 0, pendentes: 0 },
    }));
  });

export const getProcesso = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [proc, itens, docs] = await Promise.all([
      context.supabase
        .from("processos_sei")
        .select("*, unidades(id, nome, tipo)")
        .eq("id", data.id)
        .maybeSingle(),
      context.supabase
        .from("processo_itens")
        .select("*")
        .eq("processo_id", data.id)
        .order("ordem"),
      context.supabase
        .from("documentos")
        .select("*")
        .eq("processo_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (proc.error) throw proc.error;
    if (!proc.data) throw new Error("Processo não encontrado");
    if (itens.error) throw itens.error;
    if (docs.error) throw docs.error;
    return { processo: proc.data, itens: itens.data ?? [], documentos: docs.data ?? [] };
  });

const processoSchema = z.object({
  id: z.string().uuid().optional(),
  unidade_id: z.string().uuid(),
  numero: z.string().trim().min(3).max(80),
  assunto: z.string().trim().max(300).nullable().optional(),
  tipo: z.string().trim().max(60),
  orgao: ORGAO.nullable().optional(),
  situacao: z.string().trim().max(40),
  data_abertura: z.string().nullable().optional(),
  data_conclusao: z.string().nullable().optional(),
  link: z.string().trim().max(500).nullable().optional(),
  responsavel: z.string().trim().max(120).nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export const upsertProcesso = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => processoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    if (data.id) {
      const { error } = await context.supabase
        .from("processos_sei")
        .update(clean)
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("processos_sei")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    // Ao abrir um processo novo com órgão definido, o checklist da documentação
    // exigida por esse órgão é criado logo — evita processos sem checklist.
    if (data.orgao) {
      const { data: tpl } = await context.supabase
        .from("processo_checklist_templates")
        .select("*")
        .eq("orgao", data.orgao)
        .order("ordem");
      if (tpl && tpl.length > 0) {
        await context.supabase.from("processo_itens").insert(
          tpl.map((t) => ({
            processo_id: ins.id,
            template_id: t.id,
            titulo: t.titulo,
            descricao: t.descricao,
            orgao: data.orgao,
            obrigatorio: t.obrigatorio,
            ordem: t.ordem,
            responsavel: t.responsavel_padrao,
            situacao: "pendente",
          })),
        );
      }
    }
    return { id: ins.id };
  });

export const deleteProcesso = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("processos_sei").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Gera (ou completa) o checklist do processo a partir dos modelos do órgão.
 * O índice único (processo_id, template_id) impede duplicar itens quando a ação
 * é disparada duas vezes.
 */
export const gerarChecklistProcesso = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) =>
    z.object({ processo_id: z.string().uuid(), orgao: ORGAO.optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: proc, error: pe } = await context.supabase
      .from("processos_sei")
      .select("id, orgao")
      .eq("id", data.processo_id)
      .maybeSingle();
    if (pe) throw pe;
    if (!proc) throw new Error("Processo não encontrado");
    const orgao = data.orgao ?? proc.orgao;
    if (!orgao) throw new Error("Defina o órgão do processo antes de gerar o checklist");
    const { data: tpl, error: te } = await context.supabase
      .from("processo_checklist_templates")
      .select("*")
      .eq("orgao", orgao)
      .order("ordem");
    if (te) throw te;
    if (!tpl || tpl.length === 0) {
      throw new Error("Ainda não há modelo de documentação para este órgão");
    }
    // O índice único (processo_id, template_id) é parcial, logo o PostgREST não
    // aceita "on_conflict"; filtramos os itens já existentes antes de inserir.
    const { data: existentes, error: ee } = await context.supabase
      .from("processo_itens")
      .select("template_id")
      .eq("processo_id", data.processo_id)
      .not("template_id", "is", null);
    if (ee) throw ee;
    const jaCriados = new Set((existentes ?? []).map((i) => i.template_id));
    const linhas = tpl
      .filter((t) => !jaCriados.has(t.id))
      .map((t) => ({
      processo_id: data.processo_id,
      template_id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      orgao,
      obrigatorio: t.obrigatorio,
      ordem: t.ordem,
      responsavel: t.responsavel_padrao,
      situacao: "pendente",
    }));
    if (linhas.length === 0) return { criados: 0 };
    const { error } = await context.supabase.from("processo_itens").insert(linhas);
    if (error) throw error;
    return { criados: linhas.length };
  });

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  processo_id: z.string().uuid(),
  titulo: z.string().trim().min(2).max(200),
  descricao: z.string().trim().max(1000).nullable().optional(),
  orgao: ORGAO.nullable().optional(),
  obrigatorio: z.boolean(),
  ordem: z.number().int(),
  situacao: z.enum(["pendente", "em_curso", "entregue", "dispensado"]),
  responsavel: z.string().trim().max(120).nullable().optional(),
  prazo: z.string().nullable().optional(),
  data_entrega: z.string().nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export const upsertProcessoItem = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => itemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    if (data.id) {
      const { error } = await context.supabase
        .from("processo_itens")
        .update(clean)
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("processo_itens")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

/** Alteração rápida da situação de um item, direto na lista. */
export const setSituacaoItem = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        situacao: z.enum(["pendente", "em_curso", "entregue", "dispensado"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { situacao: string; data_entrega?: string | null } = { situacao: data.situacao };
    if (data.situacao === "entregue") patch.data_entrega = new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase.from("processo_itens").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteProcessoItem = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("processo_itens").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
