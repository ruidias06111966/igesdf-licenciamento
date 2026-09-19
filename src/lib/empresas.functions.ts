import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAcesso, requireMaster } from "@/lib/acesso-middleware";

/**
 * Empresas clientes servidas por esta instalação.
 *
 * Gerir empresas é do master: criar uma empresa é abrir espaço a um cliente
 * novo, e trocar-lhe o logótipo muda o timbre dos documentos que saem para os
 * órgãos licenciadores. Ler é de qualquer perfil, porque a interface e as
 * exportações precisam do nome e do logótipo para os mostrar.
 *
 * Nota sobre o estado atual: enquanto o isolamento entre empresas não estiver
 * feito, `listarEmpresas` devolve todas a quem tiver acesso ao sistema. Quando
 * essa etapa chegar, é aqui que se passa a filtrar pelas empresas da pessoa.
 */

const BUCKET = "empresa-logos";

const empresaSchema = z.object({
  id: z.string().uuid().optional(),
  sigla: z
    .string()
    .trim()
    .min(2, "A sigla precisa de pelo menos 2 caracteres.")
    .max(20, "A sigla não pode passar de 20 caracteres."),
  nome: z.string().trim().min(3, "Indique o nome por extenso.").max(200),
  cnpj_raiz: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 8, "A raiz do CNPJ tem 8 dígitos.")
    .optional(),
  ativa: z.boolean().optional(),
});

export const listarEmpresas = createServerFn({ method: "GET" })
  .middleware([requireAcesso])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("empresas")
      .select("id, sigla, nome, cnpj_raiz, logo_path, ativa, created_at")
      .order("ativa", { ascending: false })
      .order("sigla", { ascending: true });
    if (error) throw new Error(error.message);

    // As unidades vêm à parte e contam-se aqui, em vez de um agregado do
    // PostgREST: são poucas dezenas, e assim não se depende de a relação estar
    // declarada nos tipos gerados.
    const { data: unidades, error: erroUnidades } = await context.supabase
      .from("unidades")
      .select("empresa_id")
      .eq("ativa", true);
    if (erroUnidades) throw new Error(erroUnidades.message);

    const porEmpresa = new Map<string, number>();
    for (const u of unidades ?? []) {
      if (u.empresa_id) porEmpresa.set(u.empresa_id, (porEmpresa.get(u.empresa_id) ?? 0) + 1);
    }

    return (data ?? []).map((e) => ({
      ...e,
      logo_url: urlDoLogo(e.logo_path),
      unidadesAtivas: porEmpresa.get(e.id) ?? 0,
    }));
  });

/**
 * Endereço público do logótipo.
 *
 * O bucket é público de propósito (ver a migração): o endereço tem de continuar
 * a funcionar dentro de um PDF aberto semanas depois, e um link assinado
 * expirava.
 */
function urlDoLogo(caminho: string | null): string | null {
  if (!caminho) return null;
  const base = process.env["SUPABASE_URL"];
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${caminho}`;
}

export const upsertEmpresa = createServerFn({ method: "POST" })
  .middleware([requireMaster])
  .inputValidator((input: unknown) => empresaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const registo = {
      sigla: data.sigla,
      nome: data.nome,
      cnpj_raiz: data.cnpj_raiz ? data.cnpj_raiz : null,
      ativa: data.ativa ?? true,
    };

    if (data.id) {
      const { error } = await context.supabase.from("empresas").update(registo).eq("id", data.id);
      if (error) throw new Error(mensagemDeSigla(error.message, data.sigla));
      return { id: data.id };
    }

    const { data: criada, error } = await context.supabase
      .from("empresas")
      .insert(registo)
      .select("id")
      .single();
    if (error) throw new Error(mensagemDeSigla(error.message, data.sigla));
    return { id: criada.id };
  });

/** O índice único da sigla dá um erro do Postgres; aqui vira português. */
function mensagemDeSigla(erro: string, sigla: string): string {
  return erro.includes("empresas_sigla_ativa_idx")
    ? `Já existe uma empresa ativa com a sigla ${sigla}.`
    : erro;
}

/**
 * Desativa a empresa em vez de a apagar.
 *
 * Apagar arrastaria consigo a ligação das unidades, e com ela o rasto de a quem
 * pertenciam os licenciamentos — que é exatamente o que um sistema de
 * conformidade não pode perder. Uma empresa desativada deixa de aparecer para
 * escolher, e o histórico fica.
 */
export const desativarEmpresa = createServerFn({ method: "POST" })
  .middleware([requireMaster])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("empresas")
      .update({ ativa: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const enviarLogoEmpresa = createServerFn({ method: "POST" })
  .middleware([requireMaster])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Envio inválido: esperado FormData");
    const arquivo = input.get("arquivo");
    const empresaId = input.get("empresaId");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      throw new Error("Nenhum ficheiro recebido.");
    }
    // O logótipo é embebido em PDFs e folhas de exportação; acima disto o
    // documento fica pesado de mais para anexar ao SEI.
    if (arquivo.size > 2 * 1024 * 1024) {
      throw new Error("O logótipo não pode passar de 2 MB.");
    }
    const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!TIPOS.includes(arquivo.type)) {
      throw new Error("Formato não aceite. Use PNG, JPG, WEBP ou SVG.");
    }
    if (typeof empresaId !== "string" || !z.string().uuid().safeParse(empresaId).success) {
      throw new Error("Empresa inválida.");
    }
    return { arquivo, empresaId };
  })
  .handler(async ({ data, context }) => {
    const extensao = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    }[data.arquivo.type]!;

    // O nome leva a data para o endereço mudar a cada troca: sem isso, o
    // logótipo antigo ficaria na cache dos navegadores e nos PDFs já abertos.
    const caminho = `${data.empresaId}/${Date.now()}.${extensao}`;

    const { error: erroUpload } = await context.supabase.storage
      .from(BUCKET)
      .upload(caminho, data.arquivo, { contentType: data.arquivo.type, upsert: false });
    if (erroUpload) throw new Error(erroUpload.message);

    const { data: anterior } = await context.supabase
      .from("empresas")
      .select("logo_path")
      .eq("id", data.empresaId)
      .maybeSingle();

    const { error } = await context.supabase
      .from("empresas")
      .update({ logo_path: caminho })
      .eq("id", data.empresaId);
    if (error) throw new Error(error.message);

    // O anterior só sai depois de o novo estar gravado na linha: se a ordem
    // fosse ao contrário e a gravação falhasse, a empresa ficava sem logótipo
    // nenhum. Falhar a apagar não é motivo para dar erro a quem trocou.
    if (anterior?.logo_path) {
      await context.supabase.storage.from(BUCKET).remove([anterior.logo_path]);
    }

    return { logo_path: caminho, logo_url: urlDoLogo(caminho) };
  });
