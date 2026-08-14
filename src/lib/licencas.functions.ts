import { createServerFn } from "@tanstack/react-start";
import { requireAcesso, requireEdicao } from "@/lib/acesso-middleware";
import { z } from "zod";
import { vaziosParaNulo } from "@/lib/sanitize";

export const listUnidades = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
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
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [uni, lics, rts, docs, cnaes] = await Promise.all([
      context.supabase.from("unidades").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("licencas").select("*").eq("unidade_id", data.id).order("orgao"),
      context.supabase
        .from("responsaveis_tecnicos")
        .select("*")
        .eq("unidade_id", data.id)
        .order("nome"),
      context.supabase
        .from("documentos")
        .select("*")
        .eq("unidade_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase.from("cnaes_unidade").select("*").eq("unidade_id", data.id).order("codigo"),
    ]);
    if (uni.error) throw uni.error;
    if (!uni.data) throw new Error("Unidade não encontrada");
    return {
      unidade: uni.data,
      licencas: lics.data ?? [],
      responsaveis: rts.data ?? [],
      documentos: docs.data ?? [],
      cnaes: cnaes.data ?? [],
    };
  });

export const deleteUnidade = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("unidades")
      .update({ ativa: false })
      .eq("id", data.id);
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
  status: z.enum([
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
  ]),
  data_vencimento: z.string().nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export const upsertCnae = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => cnaeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    if (data.id) {
      const { error } = await context.supabase
        .from("cnaes_unidade")
        .update(clean)
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("cnaes_unidade")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteCnae = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cnaes_unidade").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ Checklists ============
export const getChecklist = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => z.object({ licenca_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // fetch licença → órgão
    const { data: lic, error: le } = await context.supabase
      .from("licencas")
      .select("id, orgao")
      .eq("id", data.licenca_id)
      .maybeSingle();
    if (le) throw le;
    if (!lic) throw new Error("Licença não encontrada");
    // existing instance
    const { data: itens, error: ie } = await context.supabase
      .from("checklist_itens")
      .select("*")
      .eq("licenca_id", data.licenca_id)
      .order("ordem");
    if (ie) throw ie;
    if ((itens ?? []).length === 0) {
      // seed from template
      const { data: tpl } = await context.supabase
        .from("checklist_templates")
        .select("*")
        .eq("orgao", lic.orgao)
        .order("ordem");
      if (tpl && tpl.length) {
        const rows = tpl.map((t) => ({
          licenca_id: data.licenca_id,
          template_id: t.id,
          titulo: t.titulo,
          descricao: t.descricao,
          tipo: t.tipo,
          ordem: t.ordem,
          responsavel: t.responsavel_padrao,
          status: "pendente",
        }));
        // `upsert` com ignoreDuplicates: duas abas a abrir o mesmo checklist ao
        // mesmo tempo semeavam os itens em duplicado.
        const { error: seedError } = await context.supabase
          .from("checklist_itens")
          .upsert(rows, { onConflict: "licenca_id,template_id", ignoreDuplicates: true });
        if (seedError) throw seedError;
        const { data: created, error: readError } = await context.supabase
          .from("checklist_itens")
          .select("*")
          .eq("licenca_id", data.licenca_id)
          .order("ordem");
        if (readError) throw readError;
        return created ?? [];
      }
    }
    return itens ?? [];
  });

const checklistItemSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pendente", "em_curso", "concluido", "nao_aplicavel"]).optional(),
  responsavel: z.string().max(120).nullable().optional(),
  data_conclusao: z.string().nullable().optional(),
  observacoes: z.string().max(1000).nullable().optional(),
});

export const updateChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => checklistItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...campos } = data;
    const patch = vaziosParaNulo(campos) as Omit<typeof campos, never> & {
      concluido_por?: string;
    };
    if (patch.status === "concluido") {
      patch.data_conclusao ??= new Date().toISOString().slice(0, 10);
    }
    const { error } = await context.supabase.from("checklist_itens").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

// ============ Versionamento de documentos ============
export const registrarNovaVersao = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) =>
    z
      .object({
        documento_pai_id: z.string().uuid(),
        storage_path: z.string(),
        mime_type: z.string().max(100).nullable().optional(),
        tamanho_bytes: z.number().int().nullable().optional(),
        comentario_versao: z.string().max(400).nullable().optional(),
        data_validade: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pai, error: pe } = await context.supabase
      .from("documentos")
      .select("*")
      .eq("id", data.documento_pai_id)
      .maybeSingle();
    if (pe) throw pe;
    if (!pai) throw new Error("Documento base não encontrado");
    // arquiva versões anteriores no mesmo grupo
    await context.supabase
      .from("documentos")
      .update({ ativo: false })
      .eq("ativo", true)
      .or(`id.eq.${pai.id},documento_pai_id.eq.${pai.id}`);
    const { data: ins, error } = await context.supabase
      .from("documentos")
      .insert({
        unidade_id: pai.unidade_id,
        licenca_id: pai.licenca_id,
        categoria: pai.categoria,
        nome: pai.nome,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        tamanho_bytes: data.tamanho_bytes ?? null,
        documento_pai_id: pai.id,
        versao: (pai.versao ?? 1) + 1,
        ativo: true,
        comentario_versao: data.comentario_versao ?? null,
        data_validade: data.data_validade || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const listVersoesDocumento = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => z.object({ documento_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: base } = await context.supabase
      .from("documentos")
      .select("*")
      .eq("id", data.documento_id)
      .maybeSingle();
    if (!base) return [];
    const raizId = base.documento_pai_id ?? base.id;
    const { data: versoes, error } = await context.supabase
      .from("documentos")
      .select("*")
      .or(`id.eq.${raizId},documento_pai_id.eq.${raizId}`)
      .order("versao", { ascending: false });
    if (error) throw error;
    return versoes ?? [];
  });

export const listDashboard = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .handler(async ({ context }) => {
    // A API da base devolve no máximo 1 000 linhas por pedido. A rede já tem
    // mais licenças do que esse limite; sem paginação, as últimas linhas
    // desapareciam simultaneamente da listagem e da matriz, embora
    // continuassem guardadas na base. O segundo critério torna a paginação
    // estável quando várias licenças têm a mesma data (incluindo data nula).
    const pagina = 1000;
    const todas = [];
    for (let inicio = 0; ; inicio += pagina) {
      const { data, error } = await context.supabase
        .from("v_licencas_dashboard")
        .select("*")
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(inicio, inicio + pagina - 1);
      if (error) throw error;
      const linhas = data ?? [];
      todas.push(...linhas);
      if (linhas.length < pagina) break;
    }
    return todas;
  });

const unidadeSchema = z.object({
  id: z.string().uuid().optional(),
  numero_iges: z.number().int().nullable().optional(),
  nome: z.string().trim().min(2).max(200),
  tipo: z.enum(["hospital", "upa", "administrativo", "laboratorio", "outro"]),
  cnpj: z.string().trim().max(30).nullable().optional(),
  cf_df: z.string().trim().max(30).nullable().optional(),
  processo_sei: z.string().trim().max(60).nullable().optional(),
  endereco: z.string().trim().max(400).nullable().optional(),
  regiao_administrativa: z.string().trim().max(100).nullable().optional(),
  situacao_edificacao: z.string().trim().max(40).nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export const upsertUnidade = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => unidadeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    if (data.id) {
      const { error } = await context.supabase.from("unidades").update(clean).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("unidades")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

const licencaSchema = z.object({
  id: z.string().uuid().optional(),
  unidade_id: z.string().uuid(),
  orgao: z.enum([
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
  ]),
  descricao: z.string().trim().max(200).nullable().optional(),
  numero: z.string().trim().max(80).nullable().optional(),
  processo_sei: z.string().trim().max(60).nullable().optional(),
  status: z.enum([
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
  ]),
  data_emissao: z.string().nullable().optional(),
  data_vencimento: z.string().nullable().optional(),
  data_protocolo: z.string().nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export const upsertLicenca = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => licencaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    if (data.id) {
      const { error } = await context.supabase.from("licencas").update(clean).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("licencas")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteLicenca = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
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
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => rtSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    if (data.id) {
      const { error } = await context.supabase
        .from("responsaveis_tecnicos")
        .update(clean)
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("responsaveis_tecnicos")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteRT = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("responsaveis_tecnicos")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const registrarDocumento = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) =>
    z
      .object({
        unidade_id: z.string().uuid().nullable().optional(),
        licenca_id: z.string().uuid().nullable().optional(),
        processo_id: z.string().uuid().nullable().optional(),
        processo_item_id: z.string().uuid().nullable().optional(),
        categoria: z.string().max(50),
        nome: z.string().max(200),
        storage_path: z.string().max(400),
        mime_type: z.string().max(100).nullable().optional(),
        tamanho_bytes: z.number().int().nullable().optional(),
        descricao: z.string().max(500).nullable().optional(),
        data_validade: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const clean = vaziosParaNulo(data);
    const { data: ins, error } = await context.supabase
      .from("documentos")
      .insert(clean)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteDocumento = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), storage_path: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.storage.from("licencas-docs").remove([data.storage_path]);
    const { error } = await context.supabase.from("documentos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const signedDocUrl = createServerFn({ method: "POST" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => z.object({ path: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: sig, error } = await context.supabase.storage
      .from("licencas-docs")
      .createSignedUrl(data.path, 300);
    if (error) throw error;
    return { url: sig.signedUrl };
  });

// Marca uma versão específica como vigente (arquiva as demais do mesmo grupo)
export const setVersaoVigente = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_versao_vigente", { _doc_id: data.id });
    if (error) throw error;
    return { ok: true };
  });

// Dossiê completo por unidade (para relatório)
export const getDossieUnidade = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [uni, lics, rts, docs, cnaes, checklist] = await Promise.all([
      context.supabase.from("unidades").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("licencas").select("*").eq("unidade_id", data.id).order("orgao"),
      context.supabase
        .from("responsaveis_tecnicos")
        .select("*")
        .eq("unidade_id", data.id)
        .order("nome"),
      context.supabase
        .from("documentos")
        .select("*")
        .eq("unidade_id", data.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false }),
      context.supabase.from("cnaes_unidade").select("*").eq("unidade_id", data.id).order("codigo"),
      context.supabase
        .from("checklist_itens")
        .select("*, licencas!inner(unidade_id, orgao)")
        .eq("licencas.unidade_id", data.id)
        .order("ordem"),
    ]);
    if (uni.error) throw uni.error;
    if (!uni.data) throw new Error("Unidade não encontrada");
    return {
      unidade: uni.data,
      licencas: lics.data ?? [],
      responsaveis: rts.data ?? [],
      documentos: docs.data ?? [],
      cnaes: cnaes.data ?? [],
      checklist: checklist.data ?? [],
    };
  });

// Próximos passos globais: itens de checklist pendentes/em curso ordenados
export const listProximosPassos = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("checklist_itens")
      .select(
        "id, titulo, status, responsavel, data_conclusao, ordem, licencas!inner(id, orgao, unidade_id, data_vencimento, descricao, unidades!inner(id, nome))",
      )
      .in("status", ["pendente", "em_curso"])
      .order("ordem")
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

// ============ Envio de arquivos ============
const PREFIXO_SEGURO = /^[A-Za-z0-9][A-Za-z0-9/_-]{0,200}$/;

/**
 * Sobe um arquivo para o bucket e devolve os metadados para quem registra a
 * linha correspondente (`registrarDocumento`, `registrarNovaVersao`, normativa).
 *
 * O envio deixou de ser feito no navegador: sem contas individuais não existe
 * JWT de utilizador, e a chave publicável não tem permissão de escrita no
 * storage. Passar por aqui mantém o bucket privado e a service role no servidor.
 */
export const enviarArquivo = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Envio inválido: esperado FormData");
    const arquivo = input.get("arquivo");
    const prefixo = input.get("prefixo");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      throw new Error("Nenhum arquivo recebido");
    }
    if (arquivo.size > 25 * 1024 * 1024) {
      throw new Error("Arquivo acima do limite de 25 MB");
    }
    if (typeof prefixo !== "string" || !PREFIXO_SEGURO.test(prefixo)) {
      // Barra o uso de ".." ou de caminhos absolutos para escrever fora da pasta.
      throw new Error("Destino do arquivo inválido");
    }
    return { arquivo, prefixo };
  })
  .handler(async ({ data, context }) => {
    const nomeLimpo = data.arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const storage_path = `${data.prefixo}/${Date.now()}-${nomeLimpo}`;
    const { error } = await context.supabase.storage
      .from("licencas-docs")
      .upload(storage_path, data.arquivo, {
        contentType: data.arquivo.type || undefined,
        upsert: false,
      });
    if (error) throw error;
    return {
      storage_path,
      nome: data.arquivo.name,
      mime_type: data.arquivo.type || null,
      tamanho_bytes: data.arquivo.size,
    };
  });
