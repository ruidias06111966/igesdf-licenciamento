import { createFileRoute } from "@tanstack/react-router";

/**
 * Assistente de IA do IGESDF — endpoint de conversação em streaming.
 *
 * Só o perfil master (senha própria) chega aqui: a verificação é feita no
 * servidor com o mesmo cookie assinado do resto do sistema, porque esconder o
 * menu na interface não impediria uma chamada direta ao endpoint (e cada
 * chamada consome créditos).
 */

type Anexo = { nome: string; tipo: string; dados: string };
type Mensagem = { role: "user" | "assistant"; content: string; anexos?: Anexo[] };

const SISTEMA = `És o assistente de licenciamento do IGESDF (Instituto de Gestão Estratégica de Saúde do Distrito Federal).

Ajudas o responsável pelo licenciamento a: redigir processos, despachos, ofícios e requerimentos administrativos; interpretar normativas (RDCs da ANVISA, normativas da VISADF, legislação do DF); planear e desbloquear licenciamentos junto de VISADF, DF LEGAL, CBMDF, IBRAM, SUSDEC, PCDF, SEAGRI e SEEDF; montar checklists de documentos por órgão; e analisar documentos enviados.

Regras:
- Responde sempre em português do Brasil, com linguagem administrativa correta.
- Usa markdown (títulos, listas, tabelas) para respostas estruturadas.
- Quando redigires um documento oficial, entrega-o pronto a copiar, com cabeçalho, corpo, fundamentação legal e fecho.
- Cita a base legal quando a conheceres; se não tiveres certeza da vigência de uma norma, diz isso claramente em vez de inventar número ou data.
- Sê objetivo: primeiro a resposta, depois os detalhes.`;

function parteAnexo(a: Anexo) {
  if (a.tipo.startsWith("image/")) {
    return { type: "image_url", image_url: { url: a.dados } };
  }
  return { type: "file", file: { filename: a.nome, file_data: a.dados } };
}

export const Route = createFileRoute("/api/ia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { ehMaster } = await import("@/lib/acesso.server");
        if (!ehMaster()) {
          return new Response("Acesso restrito ao utilizador master.", { status: 403 });
        }

        const chave = process.env['LOVABLE_API_KEY'];
        if (!chave) return new Response("Assistente não configurado.", { status: 500 });

        const body = (await request.json()) as { mensagens?: Mensagem[]; modelo?: string };
        const mensagens = Array.isArray(body.mensagens) ? body.mensagens.slice(-30) : [];
        if (mensagens.length === 0) return new Response("Sem mensagens.", { status: 400 });

        const modelo =
          body.modelo === "aprofundado" ? "google/gemini-3.1-pro-preview" : "google/gemini-3.6-flash";

        const payload = mensagens.map((m) => {
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

        const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": chave,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: modelo,
            stream: true,
            messages: [{ role: "system", content: SISTEMA }, ...payload],
          }),
        });

        if (!resposta.ok || !resposta.body) {
          const texto = await resposta.text().catch(() => "");
          const mensagem =
            resposta.status === 429
              ? "Limite de pedidos atingido. Tente novamente dentro de instantes."
              : resposta.status === 402
                ? "Créditos de IA esgotados. Adicione créditos nas definições da área de trabalho."
                : `Falha do assistente (${resposta.status}). ${texto.slice(0, 300)}`;
          return new Response(mensagem, { status: resposta.status || 500 });
        }

        // Converte o SSE do gateway em texto simples, que o navegador lê
        // diretamente do corpo da resposta.
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let resto = "";
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
                  choices?: { delta?: { content?: string } }[];
                };
                const texto = json.choices?.[0]?.delta?.content;
                if (texto) controller.enqueue(encoder.encode(texto));
              } catch {
                /* fragmento incompleto: ignorado */
              }
            }
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