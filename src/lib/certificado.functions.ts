import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireEdicao } from "@/lib/acesso-middleware";
import { STATUS, linhaAplicar } from "@/lib/certificado-schemas";

/**
 * Lê o certificado arquivado e devolve o quadro de diferenças face à base.
 *
 * Não grava nada. É deliberado: quem decide o que entra na base é o
 * utilizador, no quadro de comparação.
 */
export const analisarCertificado = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) =>
    z
      .object({
        unidade_id: z.string().uuid(),
        storage_path: z.string().max(400),
        documento_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { extrairCertificado, compararComBase, conferirCnpj } =
      await import("@/lib/certificado.server");

    const [uni, lics, cnaes] = await Promise.all([
      context.supabase
        .from("unidades")
        .select("id, nome, cnpj")
        .eq("id", data.unidade_id)
        .maybeSingle(),
      context.supabase
        .from("licencas")
        .select(
          "id, orgao, descricao, numero, processo_sei, status, data_emissao, data_vencimento, observacoes",
        )
        .eq("unidade_id", data.unidade_id),
      context.supabase.from("cnaes_unidade").select("codigo").eq("unidade_id", data.unidade_id),
    ]);
    if (uni.error) throw uni.error;
    if (!uni.data) throw new Error("Unidade não encontrada");

    const baixado = await context.supabase.storage
      .from("licencas-docs")
      .download(data.storage_path);
    if (baixado.error || !baixado.data) {
      throw new Error("Não foi possível abrir o certificado arquivado.");
    }
    const mime = baixado.data.type || "application/pdf";
    if (mime !== "application/pdf" && !mime.startsWith("image/")) {
      throw new Error("Só é possível ler certificados em PDF ou imagem.");
    }
    const bytes = new Uint8Array(await baixado.data.arrayBuffer());
    if (bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error("Certificado acima de 20 MB: não é possível fazer a leitura automática.");
    }

    const { dados, tokens } = await extrairCertificado(bytes, mime);
    const analise = compararComBase(data.unidade_id, dados, lics.data ?? [], cnaes.data ?? []);
    analise.documento_id = data.documento_id ?? null;
    const aviso = conferirCnpj(analise.cabecalho.cnpj, uni.data.cnpj);
    if (aviso) analise.avisos.unshift(aviso);

    const { registarUso } = await import("@/lib/ia.server");
    void registarUso({
      perfil: "edicao",
      acao: "ler_certificado",
      tokensEntrada: tokens.entrada,
      tokensSaida: tokens.saida,
    });

    return analise;
  });

/**
 * Aplica apenas as linhas aceites, campo a campo.
 *
 * Nunca há `update` de linha inteira: só os campos escolhidos entram no
 * `patch`, para que dados preenchidos à mão e ausentes do certificado
 * continuem exatamente como estavam.
 */
export const aplicarCertificado = createServerFn({ method: "POST" })
  .middleware([requireEdicao])
  .inputValidator((input: unknown) =>
    z
      .object({
        unidade_id: z.string().uuid(),
        documento_id: z.string().uuid().nullable().optional(),
        linhas: z.array(linhaAplicar).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let cnaesCriados = 0;
    let licencasCriadas = 0;
    let licencasAtualizadas = 0;

    for (const linha of data.linhas) {
      if (linha.tipo === "cnae_novo") {
        const { error } = await context.supabase.from("cnaes_unidade").insert({
          unidade_id: data.unidade_id,
          codigo: linha.codigo,
          descricao: linha.descricao,
        });
        if (error) throw error;
        cnaesCriados += 1;
        continue;
      }
      if (linha.tipo === "licenca_nova") {
        const { error } = await context.supabase.from("licencas").insert({
          unidade_id: data.unidade_id,
          orgao: linha.orgao,
          descricao: linha.descricao || null,
          status: linha.valores.status,
          numero: linha.valores.numero ?? null,
          processo_sei: linha.valores.processo_sei ?? null,
          data_emissao: linha.valores.data_emissao ?? null,
          data_vencimento: linha.valores.data_vencimento ?? null,
          observacoes: linha.observacoes ?? null,
        });
        if (error) throw error;
        licencasCriadas += 1;
        continue;
      }
      const patch: {
        status?: (typeof STATUS)[number];
        numero?: string | null;
        processo_sei?: string | null;
        data_emissao?: string | null;
        data_vencimento?: string | null;
        observacoes?: string | null;
      } = {};
      for (const c of linha.campos) {
        if (c.campo === "status") {
          const s = STATUS.find((v) => v === c.depois);
          if (s) patch.status = s;
        } else {
          patch[c.campo] = c.depois;
        }
      }
      if (Object.keys(patch).length === 0) continue;
      const { error } = await context.supabase
        .from("licencas")
        .update(patch)
        .eq("id", linha.licenca_id)
        .eq("unidade_id", data.unidade_id);
      if (error) throw error;
      licencasAtualizadas += 1;
    }

    // Trilha de auditoria: fica registado o que o certificado alterou e qual
    // documento serviu de base.
    await context.supabase.from("atividade_log").insert({
      entidade: "unidades",
      entidade_id: data.unidade_id,
      acao: "aplicar_certificado",
      detalhes: {
        documento_id: data.documento_id ?? null,
        cnaes_criados: cnaesCriados,
        licencas_criadas: licencasCriadas,
        licencas_atualizadas: licencasAtualizadas,
        linhas: data.linhas,
      },
    });

    return { cnaesCriados, licencasCriadas, licencasAtualizadas };
  });

/**
 * Lista os certificados já arquivados, para poderem ser relidos.
 *
 * Serve o recadastro: documentos arquivados antes de a leitura passar a
 * trazer condicionantes podem ser reprocessados sem novo upload.
 */
export const listarCertificados = createServerFn({ method: "GET" })
  .middleware([requireEdicao])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documentos")
      .select("id, nome, storage_path, mime_type, created_at, unidade_id, unidades(nome)")
      .eq("categoria", "certificado")
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((d) => ({
      id: d.id,
      nome: d.nome,
      storage_path: d.storage_path,
      mime_type: d.mime_type,
      created_at: d.created_at,
      unidade_id: d.unidade_id,
      unidade_nome: (d.unidades as { nome: string } | null)?.nome ?? "—",
    }));
  });
