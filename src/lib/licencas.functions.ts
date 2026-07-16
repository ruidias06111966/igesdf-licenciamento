import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listUnidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("unidades")
      .select("*")
      .eq("ativa", true)
      .order("numero_iges", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  });

export const getUnidade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [uni, lics, rts, docs, cnaes] = await Promise.all([
      context.supabase.from("unidades").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("licencas").select("*").eq("unidade_id", data.id).order("orgao"),
      context.supabase.from("responsaveis_tecnicos").select("*").eq("unidade_id", data.id).order("nome"),
      context.supabase.from("documentos").select("*").eq("unidade_id", data.id).order("created_at", { ascending: false }),
      context.supabase.from("cnaes_unidade").select("*").eq("unidade_id", data.id).order("codigo"),
    ]);
    if (uni.error) throw uni.error;
    if (!uni.data) throw new Error("Unidade não encontrada");
    return { unidade: uni.data, licencas: lics.data ?? [], responsaveis: rts.data ?? [], documentos: docs.data ?? [], cnaes: cnaes.data ?? [] };
  });

export const deleteUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("unidades").update({ ativa: false }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ CNAEs ============
const cnaeSchema = z.object({
  id: z.string().uuid().optional(),
  unidade_id: z.string().uuid(),
  codigo: z.string().trim().min(3).max(30),
  descricao: z.string().trim().min(2).max(300),
  cnpj_ses_legado: z.string().trim().max(30).nullable().optional(),
  status: z.enum(["nao_iniciado","em_analise","aguardando_orgao","vigente","a_vencer","vencida","indeferida","dispensada","pendente_declaracao","em_estudo"]),
  data_vencimento: z.string().nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export const upsertCnae = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cnaeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = { ...data };
    if (clean.data_vencimento === "") clean.data_vencimento = null;
    if (data.id) {
      const { error } = await context.supabase.from("cnaes_unidade").update(clean).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("cnaes_unidade").insert(clean).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteCnae = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cnaes_unidade").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ Checklists ============
export const getChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ licenca_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // fetch licença → órgão
    const { data: lic, error: le } = await context.supabase.from("licencas").select("id, orgao").eq("id", data.licenca_id).maybeSingle();
    if (le) throw le;
    if (!lic) throw new Error("Licença não encontrada");
    // existing instance
    const { data: itens, error: ie } = await context.supabase.from("checklist_itens").select("*").eq("licenca_id", data.licenca_id).order("ordem");
    if (ie) throw ie;
    if ((itens ?? []).length === 0) {
      // seed from template
      const { data: tpl } = await context.supabase.from("checklist_templates").select("*").eq("orgao", lic.orgao).order("ordem");
      if (tpl && tpl.length) {
        const rows = tpl.map((t: any) => ({
          licenca_id: data.licenca_id, template_id: t.id, titulo: t.titulo, descricao: t.descricao,
          tipo: t.tipo, ordem: t.ordem, responsavel: t.responsavel_padrao, status: "pendente",
        }));
        const { data: created } = await context.supabase.from("checklist_itens").insert(rows).select("*").order("ordem");
        return created ?? [];
      }
    }
    return itens ?? [];
  });

const checklistItemSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pendente","em_curso","concluido","nao_aplicavel"]).optional(),
  responsavel: z.string().max(120).nullable().optional(),
  data_conclusao: z.string().nullable().optional(),
  observacoes: z.string().max(1000).nullable().optional(),
});

export const updateChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checklistItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const patch: any = { ...data };
    delete patch.id;
    if (patch.data_conclusao === "") patch.data_conclusao = null;
    if (patch.status === "concluido" && !patch.data_conclusao) patch.data_conclusao = new Date().toISOString().slice(0,10);
    if (patch.status === "concluido") patch.concluido_por = context.userId;
    const { error } = await context.supabase.from("checklist_itens").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ Versionamento de documentos ============
export const registrarNovaVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    documento_pai_id: z.string().uuid(),
    storage_path: z.string(),
    mime_type: z.string().max(100).nullable().optional(),
    tamanho_bytes: z.number().int().nullable().optional(),
    comentario_versao: z.string().max(400).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: pai, error: pe } = await context.supabase.from("documentos").select("*").eq("id", data.documento_pai_id).maybeSingle();
    if (pe) throw pe;
    if (!pai) throw new Error("Documento base não encontrado");
    // arquiva versões anteriores no mesmo grupo
    await context.supabase.from("documentos").update({ ativo: false })
      .eq("ativo", true)
      .or(`id.eq.${pai.id},documento_pai_id.eq.${pai.id}`);
    const { data: ins, error } = await context.supabase.from("documentos").insert({
      unidade_id: pai.unidade_id, licenca_id: pai.licenca_id, categoria: pai.categoria,
      nome: pai.nome, storage_path: data.storage_path, mime_type: data.mime_type ?? null,
      tamanho_bytes: data.tamanho_bytes ?? null, uploaded_by: context.userId,
      documento_pai_id: pai.id, versao: (pai.versao ?? 1) + 1, ativo: true,
      comentario_versao: data.comentario_versao ?? null,
    }).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });

export const listVersoesDocumento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ documento_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: base } = await context.supabase.from("documentos").select("*").eq("id", data.documento_id).maybeSingle();
    if (!base) return [];
    const raizId = base.documento_pai_id ?? base.id;
    const { data: versoes, error } = await context.supabase.from("documentos").select("*")
      .or(`id.eq.${raizId},documento_pai_id.eq.${raizId}`)
      .order("versao", { ascending: false });
    if (error) throw error;
    return versoes ?? [];
  });

export const listDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("v_licencas_dashboard")
      .select("*")
      .order("data_vencimento", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  });

const unidadeSchema = z.object({
  id: z.string().uuid().optional(),
  numero_iges: z.number().int().nullable().optional(),
  nome: z.string().trim().min(2).max(200),
  tipo: z.enum(["hospital","upa","administrativo","laboratorio","outro"]),
  cnpj: z.string().trim().max(30).nullable().optional(),
  cf_df: z.string().trim().max(30).nullable().optional(),
  processo_sei: z.string().trim().max(60).nullable().optional(),
  endereco: z.string().trim().max(400).nullable().optional(),
  regiao_administrativa: z.string().trim().max(100).nullable().optional(),
  situacao_edificacao: z.string().trim().max(40).nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export const upsertUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => unidadeSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("unidades").update(data).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("unidades").insert(data).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });

const licencaSchema = z.object({
  id: z.string().uuid().optional(),
  unidade_id: z.string().uuid(),
  orgao: z.enum(["VISA","CBMDF","IBRAM","SEOP","PCDF","SEAGRI","SEEDF","DEFESA_CIVIL","CNES","ADM_REGIONAL","CRM","COREN","CRF","CNEN","ANVISA","JUCIS","OUTRO"]),
  descricao: z.string().trim().max(200).nullable().optional(),
  numero: z.string().trim().max(80).nullable().optional(),
  processo_sei: z.string().trim().max(60).nullable().optional(),
  status: z.enum(["nao_iniciado","em_analise","aguardando_orgao","vigente","a_vencer","vencida","indeferida","dispensada","pendente_declaracao","em_estudo"]),
  data_emissao: z.string().nullable().optional(),
  data_vencimento: z.string().nullable().optional(),
  data_protocolo: z.string().nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export const upsertLicenca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => licencaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = { ...data };
    (["data_emissao","data_vencimento","data_protocolo"] as const).forEach(k => {
      if (clean[k] === "" || clean[k] === undefined) clean[k] = null;
    });
    if (data.id) {
      const { error } = await context.supabase.from("licencas").update(clean).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("licencas").insert(clean).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteLicenca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("licencas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const rtSchema = z.object({
  id: z.string().uuid().optional(),
  unidade_id: z.string().uuid(),
  nome: z.string().trim().min(2).max(200),
  cpf: z.string().trim().max(20).nullable().optional(),
  conselho: z.string().trim().max(20).nullable().optional(),
  numero_registro: z.string().trim().max(40).nullable().optional(),
  cargo: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  telefone: z.string().trim().max(30).nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export const upsertRT = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rtSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("responsaveis_tecnicos").update(data).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("responsaveis_tecnicos").insert(data).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteRT = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("responsaveis_tecnicos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const registrarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    unidade_id: z.string().uuid().nullable().optional(),
    licenca_id: z.string().uuid().nullable().optional(),
    categoria: z.string().max(50),
    nome: z.string().max(200),
    storage_path: z.string().max(400),
    mime_type: z.string().max(100).nullable().optional(),
    tamanho_bytes: z.number().int().nullable().optional(),
    descricao: z.string().max(500).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ins, error } = await context.supabase.from("documentos").insert({ ...data, uploaded_by: context.userId }).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), storage_path: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.storage.from("licencas-docs").remove([data.storage_path]);
    const { error } = await context.supabase.from("documentos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const signedDocUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: sig, error } = await context.supabase.storage.from("licencas-docs").createSignedUrl(data.path, 300);
    if (error) throw error;
    return { url: sig.signedUrl };
  });
