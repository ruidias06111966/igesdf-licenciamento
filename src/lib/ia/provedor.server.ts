/**
 * De quem vem a resposta do assistente.
 *
 * O sistema falava só com a passagem de IA da Lovable, no formato da OpenAI.
 * Para sair da Lovable era preciso poder falar com outro sítio — e trocar de um
 * dia para o outro deixaria o assistente em baixo entre a mudança do código e a
 * chegada da chave nova.
 *
 * Por isso os dois caminhos coexistem e a escolha é uma variável de ambiente:
 * com `ANTHROPIC_API_KEY` definida fala-se direto com a Anthropic; sem ela,
 * continua a Lovable. Quando a Lovable sair de cena, é este ficheiro que perde
 * metade.
 *
 * Os dois falam línguas diferentes — o sistema é campo próprio num e mensagem
 * no outro, os anexos têm formatos distintos e os eventos de streaming não se
 * parecem — por isso cada um tem aqui o seu adaptador, e para fora ambos dão a
 * mesma coisa: texto simples, em streaming, e a contagem de tokens no fim.
 */

export type Anexo = { nome: string; tipo: string; dados: string };
export type Mensagem = { role: "user" | "assistant"; content: string; anexos?: Anexo[] };

export type PedidoIa = {
  sistema: string;
  mensagens: Mensagem[];
  /** Respostas de ação são curtas; a conversa livre pode precisar de espaço. */
  maxTokens: number;
  /** `true` para o modelo mais capaz, mais lento e mais caro. */
  aprofundado: boolean;
  sinal: AbortSignal;
};

export type RespostaIa =
  | { ok: true; corpo: ReadableStream<Uint8Array>; ler: LerEventos }
  | { ok: false; estado: number; mensagem: string };

/** Extrai texto e consumo do fluxo de eventos de um provedor. */
export type LerEventos = (
  linha: string,
  emitir: (texto: string) => void,
  uso: { entrada: number; saida: number },
) => void;

/** Base64 puro de um data URL ("data:...;base64,XXXX"). */
function base64(dados: string): string {
  const i = dados.indexOf("base64,");
  return i >= 0 ? dados.slice(i + 7) : dados;
}

function dataUrl(a: Anexo): string {
  return a.dados.startsWith("data:") ? a.dados : `data:${a.tipo};base64,${base64(a.dados)}`;
}

/** Ficheiros de texto vão como texto, com um tecto para não estourar o pedido. */
function textoDoAnexo(a: Anexo): string {
  let conteudo = "";
  try {
    conteudo = atob(base64(a.dados));
  } catch {
    conteudo = "(não foi possível ler o conteúdo deste ficheiro)";
  }
  return `Ficheiro anexado "${a.nome}":\n\n${conteudo.slice(0, 200_000)}`;
}

export function provedorAtivo(): "anthropic" | "lovable" | null {
  if (process.env["ANTHROPIC_API_KEY"]?.trim()) return "anthropic";
  if (process.env["LOVABLE_API_KEY"]?.trim()) return "lovable";
  return null;
}

export async function pedirIa(pedido: PedidoIa): Promise<RespostaIa> {
  const provedor = provedorAtivo();
  if (provedor === "anthropic") return pedirAnthropic(pedido);
  if (provedor === "lovable") return pedirLovable(pedido);
  console.error("[ia] nenhuma chave de IA configurada (ANTHROPIC_API_KEY ou LOVABLE_API_KEY).");
  return { ok: false, estado: 500, mensagem: "Assistente indisponível no momento." };
}

/* ------------------------------------------------------------------ */
/* Anthropic                                                           */
/* ------------------------------------------------------------------ */

function blocoAnthropic(a: Anexo) {
  if (a.tipo.startsWith("image/")) {
    return {
      type: "image",
      source: { type: "base64", media_type: a.tipo, data: base64(a.dados) },
    };
  }
  if (a.tipo === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64(a.dados) },
    };
  }
  return { type: "text", text: textoDoAnexo(a) };
}

async function pedirAnthropic(pedido: PedidoIa): Promise<RespostaIa> {
  const chave = process.env["ANTHROPIC_API_KEY"]!.trim();
  const modelo = pedido.aprofundado ? "claude-opus-5" : "claude-sonnet-5";

  const mensagens = pedido.mensagens.map((m) =>
    m.role === "user" && m.anexos?.length
      ? {
          role: "user",
          content: [
            { type: "text", text: m.content || "Analisa os documentos em anexo." },
            ...m.anexos.map(blocoAnthropic),
          ],
        }
      : { role: m.role, content: m.content },
  );

  let resposta: Response;
  try {
    resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: pedido.sinal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelo,
        stream: true,
        max_tokens: pedido.maxTokens,
        // Na Anthropic o sistema é campo próprio e não a primeira mensagem.
        system: pedido.sistema,
        messages: mensagens,
      }),
    });
  } catch (erro) {
    console.error("[ia] falha na chamada à Anthropic:", erro);
    return { ok: false, estado: 503, mensagem: erroRede() };
  }

  if (!resposta.ok || !resposta.body) {
    const detalhe = await resposta.text().catch(() => "");
    console.error(`[ia] Anthropic respondeu ${resposta.status}:`, detalhe);
    return { ok: false, ...traduzirEstado(resposta.status) };
  }

  return { ok: true, corpo: resposta.body, ler: lerAnthropic };
}

const lerAnthropic: LerEventos = (linha, emitir, uso) => {
  if (!linha.startsWith("data:")) return;
  const dados = linha.slice(5).trim();
  if (!dados) return;
  try {
    const json = JSON.parse(dados) as {
      type?: string;
      delta?: { text?: string };
      message?: { usage?: { input_tokens?: number } };
      usage?: { output_tokens?: number; input_tokens?: number };
    };
    if (json.type === "content_block_delta" && json.delta?.text) emitir(json.delta.text);
    // A entrada vem no início (`message_start`) e a saída no fim
    // (`message_delta`), ao contrário do outro provedor, que manda as duas
    // juntas no fim.
    if (json.message?.usage?.input_tokens) uso.entrada = json.message.usage.input_tokens;
    if (json.usage?.input_tokens) uso.entrada = json.usage.input_tokens;
    if (json.usage?.output_tokens) uso.saida = json.usage.output_tokens;
  } catch {
    /* fragmento incompleto: ignorado */
  }
};

/* ------------------------------------------------------------------ */
/* Lovable (formato OpenAI)                                            */
/* ------------------------------------------------------------------ */

function blocoLovable(a: Anexo) {
  if (a.tipo.startsWith("image/")) {
    return { type: "image_url", image_url: { url: dataUrl(a) } };
  }
  if (a.tipo === "application/pdf") {
    return { type: "file", file: { filename: a.nome || "documento.pdf", file_data: dataUrl(a) } };
  }
  return { type: "text", text: textoDoAnexo(a) };
}

async function pedirLovable(pedido: PedidoIa): Promise<RespostaIa> {
  const chave = process.env["LOVABLE_API_KEY"]!.trim();
  const modelo = pedido.aprofundado ? "google/gemini-3-pro-preview" : "google/gemini-3.5-flash";

  const payload: Array<Record<string, unknown>> = [{ role: "system", content: pedido.sistema }];
  for (const m of pedido.mensagens) {
    if (m.role === "user" && m.anexos?.length) {
      payload.push({
        role: "user",
        content: [
          { type: "text", text: m.content || "Analisa os documentos em anexo." },
          ...m.anexos.map(blocoLovable),
        ],
      });
    } else {
      payload.push({ role: m.role, content: m.content });
    }
  }

  let resposta: Response;
  try {
    resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: pedido.sinal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: modelo,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: pedido.maxTokens,
        messages: payload,
      }),
    });
  } catch (erro) {
    console.error("[ia] falha na chamada ao serviço de IA:", erro);
    return { ok: false, estado: 503, mensagem: erroRede() };
  }

  if (!resposta.ok || !resposta.body) {
    const detalhe = await resposta.text().catch(() => "");
    console.error(`[ia] serviço de IA respondeu ${resposta.status}:`, detalhe);
    return { ok: false, ...traduzirEstado(resposta.status) };
  }

  return { ok: true, corpo: resposta.body, ler: lerLovable };
}

const lerLovable: LerEventos = (linha, emitir, uso) => {
  if (!linha.startsWith("data:")) return;
  const dados = linha.slice(5).trim();
  if (!dados || dados === "[DONE]") return;
  try {
    const json = JSON.parse(dados) as {
      choices?: Array<{ delta?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (json.usage?.prompt_tokens) uso.entrada = json.usage.prompt_tokens;
    if (json.usage?.completion_tokens) uso.saida = json.usage.completion_tokens;
    const texto = json.choices?.[0]?.delta?.content;
    if (texto) emitir(texto);
  } catch {
    /* fragmento incompleto: ignorado */
  }
};

/* ------------------------------------------------------------------ */

function erroRede() {
  return "Serviço de IA temporariamente indisponível. Tente novamente.";
}

/**
 * Estado do provedor traduzido para o que o utilizador pode fazer a respeito.
 *
 * O corpo do erro fica só no registo do servidor: pode conter detalhes da conta
 * e nunca deve chegar ao navegador.
 */
function traduzirEstado(estado: number): { estado: number; mensagem: string } {
  if (estado === 402) {
    return {
      estado: 402,
      mensagem:
        "Créditos de IA esgotados. Recarregue os créditos da conta para voltar a usar o assistente.",
    };
  }
  if (estado === 403) {
    return { estado: 403, mensagem: "Serviço de IA bloqueado nas definições da conta." };
  }
  if (estado === 401) {
    return { estado: 500, mensagem: "Assistente indisponível no momento." };
  }
  if (estado === 429 || estado >= 500) {
    return { estado: 503, mensagem: erroRede() };
  }
  return { estado: 400, mensagem: "Não foi possível processar o pedido do assistente." };
}
