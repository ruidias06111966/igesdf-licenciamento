import { createFileRoute } from "@tanstack/react-router";

/**
 * Assistente de IA do IGESDF — endpoint de conversação em streaming.
 *
 * Só o perfil master (senha própria) chega aqui: a verificação é feita no
 * servidor com o mesmo cookie assinado do resto do sistema, porque esconder o
 * menu na interface não impediria uma chamada direta ao endpoint (e cada
 * chamada consome créditos).
 *
 * A chave `ANTHROPIC_API_KEY` é lida apenas dentro deste handler, que corre
 * exclusivamente no servidor. Nunca é enviada ao navegador nem devolvida em
 * mensagens de erro.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Anexo = { nome: string; tipo: string; dados: string };
type Mensagem = { role: "user" | "assistant"; content: string; anexos?: Anexo[] };

/** Extrai o base64 puro de um data URL ("data:...;base64,XXXX"). */
function base64(dados: string): string {
  const i = dados.indexOf("base64,");
  return i >= 0 ? dados.slice(i + 7) : dados;
}

/** Converte um anexo no bloco de conteúdo correspondente da API da Anthropic. */
function parteAnexo(a: Anexo) {
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
  // Texto simples (txt, md, csv): enviado como texto para o modelo.
  let conteudo = "";
  try {
    conteudo = atob(base64(a.dados));
  } catch {
    conteudo = "(não foi possível ler o conteúdo deste ficheiro)";
  }
  return { type: "text", text: `Ficheiro anexado "${a.nome}":\n\n${conteudo.slice(0, 200_000)}` };
}

export const Route = createFileRoute("/api/ia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { ehMaster, perfilAtual } = await import("@/lib/acesso.server");
        if (!ehMaster()) {
          return new Response("Acesso restrito ao utilizador master.", { status: 403 });
        }

        const {
          ACOES,
          acaoValida,
          sanitizarContexto,
          CONTEXTO_DOMINIO,
          LIMITE_CARACTERES,
          limiteAtingido,
          registarUso,
        } = await import("@/lib/ia.server");

        // Tamanho do pedido: um contexto gigante é rejeitado antes de gastar
        // créditos ou memória a desserializar.
        const bruto = await request.text();
        if (bruto.length > LIMITE_CARACTERES && !bruto.includes("base64,")) {
          return new Response("Pedido demasiado grande. Reduza o contexto enviado.", {
            status: 413,
          });
        }

        let body: {
          mensagens?: Mensagem[];
          modelo?: string;
          acao?: string;
          pergunta?: string;
          unidadeId?: string;
        };
        try {
          body = JSON.parse(bruto);
        } catch {
          return new Response("Corpo do pedido inválido.", { status: 400 });
        }

        const acao = body.acao ?? "pergunta_livre";
        if (!acaoValida(acao)) {
          return new Response("Ação não permitida.", { status: 400 });
        }

        const mensagens = Array.isArray(body.mensagens) ? body.mensagens.slice(-30) : [];
        if (mensagens.length === 0 && !body.pergunta) {
          return new Response("Sem mensagens.", { status: 400 });
        }

        if (await limiteAtingido()) {
          return new Response(
            "Limite de consultas de IA atingido. Tente novamente em alguns minutos.",
            { status: 429 },
          );
        }

        const chave = process.env["ANTHROPIC_API_KEY"];
        if (!chave) {
          console.error("[ia] ANTHROPIC_API_KEY não configurada no ambiente do servidor.");
          return new Response("Assistente indisponível no momento.", { status: 500 });
        }

        const modelo = body.modelo === "aprofundado" ? "claude-opus-5" : "claude-sonnet-5";

        // O contexto é montado no servidor a partir da base de dados — o
        // navegador só indica a ação e, quando aplicável, a unidade. Depois é
        // limpo: dados de pessoas físicas nunca saem do sistema.
        const { montarContexto } = await import("@/lib/ia-contexto.server");
        const unidadeId =
          typeof body.unidadeId === "string" && UUID.test(body.unidadeId) ? body.unidadeId : null;
        const contextoBruto = await montarContexto(acao, unidadeId);
        const contextoLimpo = contextoBruto === null ? null : sanitizarContexto(contextoBruto);

        const sistema =
          CONTEXTO_DOMINIO +
          `\n\nAção solicitada: ${acao} — ${ACOES[acao]}` +
          (contextoLimpo
            ? `\n\nDados do sistema (únicos dados válidos para a resposta):\n${JSON.stringify(contextoLimpo).slice(0, 60_000)}`
            : "");

        const historico: Mensagem[] =
          mensagens.length > 0
            ? mensagens
            : [{ role: "user", content: body.pergunta ?? "Analisa os dados do contexto." }];

        const payload = historico.map((m) => {
          if (m.role === "user" && m.anexos && m.anexos.length > 0) {
            return {
              role: "user",
              content: [
                { type: "text", text: m.content || "Analisa os documentos em anexo." },
                ...m.anexos.map(parteAnexo),
              ],
            };
          }
          return { role: m.role, content: m.content };
        });

        // Timeout: um pedido pendurado bloquearia o utilizador sem resposta.
        const controlo = new AbortController();
        const relogio = setTimeout(() => controlo.abort(), 60_000);

        let resposta: Response;
        try {
          resposta = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            signal: controlo.signal,
            headers: {
              "Content-Type": "application/json",
              "x-api-key": chave,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: modelo,
              stream: true,
              max_tokens: body.acao ? 2000 : 8000,
              system: sistema,
              messages: payload,
            }),
          });
        } catch (erro) {
          clearTimeout(relogio);
          console.error("[ia] falha na chamada à Anthropic:", erro);
          return new Response("Serviço de IA temporariamente indisponível. Tente novamente.", {
            status: 503,
          });
        }
        clearTimeout(relogio);

        if (!resposta.ok || !resposta.body) {
          // O corpo do erro do provedor fica só no registo do servidor: pode
          // conter detalhes da conta e nunca deve chegar ao navegador.
          const detalhe = await resposta.text().catch(() => "");
          console.error(`[ia] Anthropic respondeu ${resposta.status}:`, detalhe);
          if (resposta.status === 401 || resposta.status === 403) {
            return new Response("Assistente indisponível no momento.", { status: 500 });
          }
          if (resposta.status === 429 || resposta.status === 529 || resposta.status >= 500) {
            return new Response("Serviço de IA temporariamente indisponível. Tente novamente.", {
              status: 503,
            });
          }
          if (resposta.status === 400 && detalhe.includes("credit")) {
            return new Response(
              "Saldo esgotado na conta Anthropic. Adicione créditos em console.anthropic.com → Billing.",
              { status: 402 },
            );
          }
          return new Response("Não foi possível processar o pedido do assistente.", {
            status: 400,
          });
        }

        // Converte o SSE da Anthropic em texto simples, que o navegador lê
        // diretamente do corpo da resposta, e regista o consumo no fim.
        const perfil = perfilAtual() ?? "master";
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let resto = "";
        let entrada = 0;
        let saida = 0;
        const stream = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            resto += decoder.decode(chunk, { stream: true });
            const linhas = resto.split("\n");
            resto = linhas.pop() ?? "";
            for (const linha of linhas) {
              if (!linha.startsWith("data:")) continue;
              const dados = linha.slice(5).trim();
              if (!dados || dados === "[DONE]") continue;
              try {
                const json = JSON.parse(dados) as {
                  type?: string;
                  delta?: { type?: string; text?: string };
                  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
                  usage?: { input_tokens?: number; output_tokens?: number };
                };
                if (json.type === "message_start") {
                  entrada = json.message?.usage?.input_tokens ?? 0;
                }
                if (json.usage?.output_tokens) saida = json.usage.output_tokens;
                if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                  const texto = json.delta.text;
                  if (texto) controller.enqueue(encoder.encode(texto));
                }
              } catch {
                /* fragmento incompleto: ignorado */
              }
            }
          },
          flush() {
            void registarUso({ perfil, acao, tokensEntrada: entrada, tokensSaida: saida });
          },
        });

        return new Response(resposta.body.pipeThrough(stream), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
