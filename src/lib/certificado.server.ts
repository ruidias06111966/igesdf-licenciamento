/**
 * Leitura do certificado da unidade (REDESIM e equivalentes) e comparação com
 * o que já está na base.
 *
 * Regra que orienta todo este ficheiro: o certificado **nunca** escreve
 * sozinho. Aqui só se produz um quadro de diferenças; a gravação acontece
 * depois, e apenas nas linhas que o utilizador aceitou. Um campo que o
 * certificado não traz preenchido é ignorado — não apaga o que já existe.
 *
 * Servidor-only: a chave da Anthropic é lida apenas dentro destas funções.
 */
import { z } from "zod";
import { parseCnae, ORGAOS, type Orgao, type StatusLicenca } from "@/lib/domain";
import type { AnaliseCertificado, Diferenca, LinhaAnalise } from "@/lib/certificado";

const STATUS_VALIDOS = [
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

const ORGAOS_VALIDOS = ORGAOS.map((o) => o.value) as [Orgao, ...Orgao[]];

/**
 * Um valor fora da lista não pode fazer falhar a leitura inteira: o órgão
 * desconhecido entra como "OUTRO" e a situação desconhecida como "em_analise",
 * ficando visível no quadro de diferenças para correção manual.
 */
const orgaoTolerante = z.preprocess((v) => {
  const t = String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const mapa: Record<string, Orgao> = {
    VISADF: "VISA",
    VIGILANCIA_SANITARIA: "VISA",
    BOMBEIROS: "CBMDF",
    CBM: "CBMDF",
    DFLEGAL: "DF_LEGAL",
    DEFESA_CIVIL_DF: "SUSDEC",
  };
  if (mapa[t]) return mapa[t];
  return ORGAOS_VALIDOS.includes(t as Orgao) ? (t as Orgao) : "OUTRO";
}, z.enum(ORGAOS_VALIDOS));

const situacaoTolerante = z.preprocess((v) => {
  const t = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return (STATUS_VALIDOS as readonly string[]).includes(t) ? t : "em_analise";
}, z.enum(STATUS_VALIDOS));

const itemExtraido = z.object({
  codigo_cnae: z.string().nullable().optional(),
  descricao_cnae: z.string().nullable().optional(),
  orgao: orgaoTolerante,
  situacao: situacaoTolerante,
  numero: z.string().nullable().optional(),
  processo_sei: z.string().nullable().optional(),
  data_emissao: z.string().nullable().optional(),
  data_vencimento: z.string().nullable().optional(),
  observacao: z.string().nullable().optional(),
});

const extracaoSchema = z.object({
  cnpj: z.string().nullable().optional(),
  nome: z.string().nullable().optional(),
  emitido_em: z.string().nullable().optional(),
  cnaes: z
    .array(z.object({ codigo: z.string(), descricao: z.string().nullable().optional() }))
    .catch([])
    .default([]),
  // Itens irrecuperáveis são descartados em vez de invalidarem a leitura toda.
  itens: z
    .array(z.unknown())
    .default([])
    .transform((lista) =>
      lista.map((i) => itemExtraido.safeParse(i)).flatMap((r) => (r.success ? [r.data] : [])),
    ),
});

export type Extracao = z.infer<typeof extracaoSchema>;

const INSTRUCOES = `Você lê certificados de licenciamento de empresas do Distrito Federal (REDESIM, licenças e declarações de dispensa) e devolve os dados em JSON.

Devolva SOMENTE um objeto JSON válido, sem texto antes ou depois, com esta forma:
{
  "cnpj": "00.000.000/0000-00" | null,
  "nome": "razão social ou nome do estabelecimento" | null,
  "emitido_em": "AAAA-MM-DD" | null,
  "cnaes": [{ "codigo": "8610-1/01", "descricao": "Atividades de atendimento hospitalar" }],
  "itens": [{
    "codigo_cnae": "8610-1/01" | null,
    "descricao_cnae": "texto da atividade" | null,
    "orgao": "VISA|CBMDF|IBRAM|DF_LEGAL|SUSDEC|PCDF|SEAGRI|SEEDF|SEOP|DEFESA_CIVIL|CNES|ADM_REGIONAL|ANVISA|CNEN|CRM|COREN|CRF|JUCIS|OUTRO",
    "situacao": "vigente|dispensada|em_analise|aguardando_orgao|nao_iniciado|pendente_declaracao|indeferida|vencida|em_estudo",
    "numero": "número da licença/alvará" | null,
    "processo_sei": "número do processo" | null,
    "data_emissao": "AAAA-MM-DD" | null,
    "data_vencimento": "AAAA-MM-DD" | null,
    "observacao": "restrição, condicionante ou exigência" | null
  }]
}

Regras obrigatórias:
- Um item por cruzamento CNAE × órgão que apareça no documento.
- "VISA" é a Vigilância Sanitária do DF (VISADF). "DF_LEGAL" é a Secretaria de Proteção da Ordem Urbanística. "SUSDEC" é a Defesa Civil. "CBMDF" é o Corpo de Bombeiros.
- Quando o documento diz que a atividade é dispensada, isenta ou de baixo risco para aquele órgão, use "dispensada".
- Nunca invente número, processo ou data: o que não constar no documento vai como null.
- Datas sempre no formato AAAA-MM-DD.`;

function base64(bytes: Uint8Array): string {
  let bin = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(bin);
}

type Bruto = { texto: string; tokens: { entrada: number; saida: number } };

const PEDIDO = "Extraia os dados deste certificado em JSON.";

/** Leitura pelo serviço de IA da plataforma (não depende de créditos próprios). */
async function lerPelaPlataforma(arquivo: Uint8Array, mime: string): Promise<Bruto> {
  const chave = process.env["LOVABLE_API_KEY"];
  if (!chave) throw new Error("sem-chave-plataforma");
  const dataUrl = `data:${mime};base64,${base64(arquivo)}`;
  const conteudo =
    mime === "application/pdf"
      ? [{ type: "file", file: { filename: "certificado.pdf", file_data: dataUrl } }]
      : [{ type: "image_url", image_url: { url: dataUrl } }];

  const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      max_tokens: 16000,
      messages: [
        { role: "system", content: INSTRUCOES },
        { role: "user", content: [...conteudo, { type: "text", text: PEDIDO }] },
      ],
    }),
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    console.error(`[certificado] plataforma respondeu ${resposta.status}:`, detalhe.slice(0, 500));
    if (resposta.status === 402 || /credit/i.test(detalhe)) throw new Error(SEM_CREDITOS);
    if (resposta.status === 429) throw new Error("limite-plataforma");
    throw new Error(`plataforma-${resposta.status}`);
  }
  const json = (await resposta.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    texto: json.choices?.[0]?.message?.content ?? "",
    tokens: {
      entrada: json.usage?.prompt_tokens ?? 0,
      saida: json.usage?.completion_tokens ?? 0,
    },
  };
}

/** Leitura pela conta Anthropic do utilizador (usada como alternativa). */
async function lerPelaAnthropic(arquivo: Uint8Array, mime: string): Promise<Bruto> {
  const chave = process.env["ANTHROPIC_API_KEY"];
  if (!chave) throw new Error("sem-chave-anthropic");
  const bloco =
    mime === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64(arquivo) },
        }
      : { type: "image", source: { type: "base64", media_type: mime, data: base64(arquivo) } };

  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      system: INSTRUCOES,
      messages: [{ role: "user", content: [bloco, { type: "text", text: PEDIDO }] }],
    }),
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    console.error(`[certificado] Anthropic respondeu ${resposta.status}:`, detalhe.slice(0, 500));
    throw new Error(`anthropic-${resposta.status}`);
  }
  const json = (await resposta.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    texto: (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join(""),
    tokens: { entrada: json.usage?.input_tokens ?? 0, saida: json.usage?.output_tokens ?? 0 },
  };
}

/**
 * Lê o certificado e devolve os dados estruturados.
 *
 * A leitura corre primeiro pelo serviço de IA da plataforma; a conta Anthropic
 * própria só é usada como alternativa. Assim, ficar sem créditos numa delas
 * deixa de bloquear a leitura de PDFs.
 */
export async function extrairCertificado(
  arquivo: Uint8Array,
  mime: string,
): Promise<{ dados: Extracao; tokens: { entrada: number; saida: number } }> {
  let bruto: Bruto;
  try {
    bruto = await lerPelaPlataforma(arquivo, mime);
  } catch (erro) {
    console.error("[certificado] leitura pela plataforma falhou:", erro);
    try {
      bruto = await lerPelaAnthropic(arquivo, mime);
    } catch (erro2) {
      console.error("[certificado] leitura pela Anthropic falhou:", erro2);
      throw new Error(
        "Não foi possível ler o documento agora. Verifique se é um PDF ou imagem legível e tente novamente.",
      );
    }
  }

  const texto = bruto.texto;
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) {
    throw new Error("O documento não pôde ser interpretado como certificado de licenciamento.");
  }
  let objeto: unknown;
  try {
    objeto = JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    throw new Error("O documento não pôde ser interpretado como certificado de licenciamento.");
  }
  return { dados: extracaoSchema.parse(objeto), tokens: bruto.tokens };
}

/** Só os dígitos do CNAE — "8610-1/01", "8610101" e "8610-1/01 " são o mesmo. */
function normCnae(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = valor.replace(/\D/g, "");
  return d.length >= 5 ? d : null;
}

function normData(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const t = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const br = t.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function limpar(valor: string | null | undefined): string | null {
  const t = (valor ?? "").trim();
  return t.length > 0 ? t : null;
}

function formatarCnae(codigo: string | null, descricao: string | null): string {
  if (codigo && descricao) return `CNAE ${codigo} — ${descricao}`;
  if (codigo) return `CNAE ${codigo}`;
  return descricao ?? "Atividade não identificada";
}

type LicencaExistente = {
  id: string;
  orgao: string;
  descricao: string | null;
  numero: string | null;
  processo_sei: string | null;
  status: string;
  data_emissao: string | null;
  data_vencimento: string | null;
  observacoes?: string | null;
};

/**
 * Compara o que o certificado diz com o que a base tem, para esta unidade.
 *
 * O que sai daqui é apenas uma proposta. Campos vazios no certificado não
 * geram diferença — é isso que impede a leitura de apagar dados preenchidos
 * à mão (número de processo, observações, datas de protocolo).
 */
export function compararComBase(
  unidadeId: string,
  extracao: Extracao,
  licencas: LicencaExistente[],
  cnaesExistentes: { codigo: string }[],
): AnaliseCertificado {
  const linhas: LinhaAnalise[] = [];
  const avisos: string[] = [];

  const chaveDe = (orgao: string, cnae: string | null) => `${orgao}|${cnae ?? "-"}`;

  const porChave = new Map<string, LicencaExistente>();
  for (const l of licencas) {
    const k = chaveDe(l.orgao, normCnae(parseCnae(l.descricao).codigo));
    if (!porChave.has(k)) porChave.set(k, l);
  }

  const vistos = new Set<string>();

  // CNAEs novos
  const codigosBase = new Set(cnaesExistentes.map((c) => normCnae(c.codigo)).filter(Boolean));
  for (const c of extracao.cnaes) {
    const n = normCnae(c.codigo);
    if (!n || codigosBase.has(n)) continue;
    codigosBase.add(n);
    linhas.push({
      tipo: "cnae_novo",
      chave: `cnae:${n}`,
      codigo: c.codigo.trim(),
      descricao: limpar(c.descricao) ?? "Atividade sem descrição no certificado",
    });
  }

  for (const item of extracao.itens) {
    const cnae = normCnae(item.codigo_cnae);
    const k = chaveDe(item.orgao, cnae);
    if (vistos.has(k)) {
      avisos.push(
        `O certificado traz mais de um registo para ${item.orgao} / CNAE ${item.codigo_cnae ?? "—"}. Só o primeiro foi considerado.`,
      );
      continue;
    }
    vistos.add(k);

    const descricao = formatarCnae(limpar(item.codigo_cnae), limpar(item.descricao_cnae));
    const existente = porChave.get(k);

    const proposto = {
      status: item.situacao as StatusLicenca,
      numero: limpar(item.numero),
      processo_sei: limpar(item.processo_sei),
      data_emissao: normData(item.data_emissao),
      data_vencimento: normData(item.data_vencimento),
    };

    if (!existente) {
      linhas.push({
        tipo: "licenca_nova",
        chave: `nova:${k}`,
        orgao: item.orgao,
        cnae: limpar(item.codigo_cnae),
        descricao,
        valores: proposto,
        observacoes: limpar(item.observacao),
      });
      continue;
    }

    const campos: Diferenca[] = [];
    const comparar = (campo: Diferenca["campo"], antes: string | null, depois: string | null) => {
      // Valor ausente no certificado nunca apaga o que está na base.
      if (depois === null) return;
      if ((antes ?? "") === depois) return;
      campos.push({ campo, antes, depois });
    };
    comparar("status", existente.status, proposto.status);
    comparar("numero", existente.numero, proposto.numero);
    comparar("processo_sei", existente.processo_sei, proposto.processo_sei);
    comparar("data_emissao", existente.data_emissao, proposto.data_emissao);
    comparar("data_vencimento", existente.data_vencimento, proposto.data_vencimento);
    // Condicionantes e restrições do certificado: se a base ainda não as tem,
    // acrescentam-se ao que lá está em vez de substituir o texto escrito à mão.
    const obsCert = limpar(item.observacao);
    if (obsCert) {
      const obsBase = limpar(existente.observacoes ?? null);
      if (!obsBase) comparar("observacoes", null, obsCert);
      else if (!obsBase.includes(obsCert)) comparar("observacoes", obsBase, `${obsBase}\n${obsCert}`);
    }

    linhas.push(
      campos.length > 0
        ? {
            tipo: "licenca_alterada",
            chave: `alt:${existente.id}`,
            licenca_id: existente.id,
            orgao: item.orgao,
            cnae: limpar(item.codigo_cnae),
            descricao: existente.descricao ?? descricao,
            campos,
          }
        : {
            tipo: "licenca_igual",
            chave: `igual:${existente.id}`,
            licenca_id: existente.id,
            orgao: item.orgao,
            cnae: limpar(item.codigo_cnae),
            descricao: existente.descricao ?? descricao,
          },
    );
  }

  // Licenças que existem na base e não aparecem no certificado: apenas sinalizadas.
  for (const [k, l] of porChave) {
    if (vistos.has(k)) continue;
    linhas.push({
      tipo: "licenca_ausente",
      chave: `ausente:${l.id}`,
      licenca_id: l.id,
      orgao: l.orgao as Orgao,
      cnae: parseCnae(l.descricao).codigo,
      descricao: l.descricao ?? "—",
    });
  }

  return {
    unidade_id: unidadeId,
    documento_id: null,
    cabecalho: {
      cnpj: limpar(extracao.cnpj),
      nome: limpar(extracao.nome),
      emitido_em: normData(extracao.emitido_em),
    },
    linhas,
    avisos,
  };
}

/** Compara CNPJ do certificado com o da unidade, para não cruzar unidades. */
export function conferirCnpj(
  cnpjCertificado: string | null,
  cnpjUnidade: string | null,
): string | null {
  const a = (cnpjCertificado ?? "").replace(/\D/g, "");
  const b = (cnpjUnidade ?? "").replace(/\D/g, "");
  if (!a || !b) return null;
  if (a === b) return null;
  return `Atenção: o CNPJ do certificado (${cnpjCertificado}) é diferente do CNPJ registado na unidade (${cnpjUnidade}). Confirme se escolheu a unidade certa.`;
}
