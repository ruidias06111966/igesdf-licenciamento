import { createFileRoute } from "@tanstack/react-router";
import type { Anexo, Mensagem } from "@/lib/ia/provedor.server";

/**
 * Assistente de IA — endpoint de conversação em streaming.
 *
 * Só o perfil master chega aqui, e a verificação é feita no servidor a partir
 * do token da sessão: esconder o menu na interface não impediria uma chamada
 * direta ao endpoint, e cada chamada gasta créditos. O contexto que acompanha a
 * pergunta fica preso à empresa de quem pergunta.
 *
 * Com quem se fala — Anthropic ou a passagem da Lovable — decide-se em
 * `@/lib/ia/provedor.server`, conforme a chave que estiver no ambiente. A chave
 * é lida só lá, no servidor, e nunca é enviada ao navegador nem devolvida em
 * mensagens de erro.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/ia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { sessaoAtual, autorAtual } = await import("@/lib/acesso.server");
        const sessao = await sessaoAtual();
        if (sessao?.perfil !== "master") {
          return new Response("Acesso restrito ao utilizador master.", { status: 403 });
        }
        // O contexto que acompanha a pergunta sai da base de dados: tem de
        // ficar preso à empresa de quem pergunta, ou um master de empresa
        // recebia nas respostas os dados das outras.
        const { escopoDaSessao } = await import("@/lib/escopo.server");
        const escopo = escopoDaSessao(sessao);

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

        const modoAprofundado = body.modelo === "aprofundado";

        // O contexto é montado no servidor a partir da base de dados — o
        // navegador só indica a ação e, quando aplicável, a unidade. Depois é
        // limpo: dados de pessoas físicas nunca saem do sistema.
        const { montarContexto } = await import("@/lib/ia-contexto.server");
        const unidadeId =
          typeof body.unidadeId === "string" && UUID.test(body.unidadeId) ? body.unidadeId : null;
        const contextoBruto = await montarContexto(acao, escopo, unidadeId);
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

        // Timeout: um pedido pendurado bloquearia o utilizador sem resposta.
        const controlo = new AbortController();
        const relogio = setTimeout(() => controlo.abort(), 120_000);
        const { pedirIa } = await import("@/lib/ia/provedor.server");
        const resultado = await pedirIa({
          sistema,
          mensagens: historico,
          maxTokens: body.acao ? 2000 : 8000,
          aprofundado: modoAprofundado,
          sinal: controlo.signal,
        });
        clearTimeout(relogio);

        if (!resultado.ok) {
          return new Response(resultado.mensagem, { status: resultado.estado });
        }

        // Converte o fluxo de eventos do provedor em texto simples, que o
        // navegador lê diretamente do corpo da resposta, e regista o consumo.
        const perfil = (await autorAtual()) ?? "master";
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let resto = "";
        const uso = { entrada: 0, saida: 0 };
        const stream = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            resto += decoder.decode(chunk, { stream: true });
            const linhas = resto.split("\n");
            resto = linhas.pop() ?? "";
            for (const linha of linhas) {
              resultado.ler(linha, (texto) => controller.enqueue(encoder.encode(texto)), uso);
            }
          },
          flush() {
            void registarUso({
              perfil,
              acao,
              tokensEntrada: uso.entrada,
              tokensSaida: uso.saida,
            });
          },
        });

        return new Response(resultado.corpo.pipeThrough(stream), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
