import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Check,
  Copy,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { unidadesQuery } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { BibliotecaModelos, GuardarModelo } from "@/components/modelos-ia";
import { useEhMaster } from "@/lib/perfil";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ia")({
  component: PaginaIA,
  head: () => ({
    meta: [
      { title: "Assistente IA — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Assistente de inteligência artificial para redigir despachos, processos e resolver questões de licenciamento das unidades do IGESDF.",
      },
      { property: "og:title", content: "Assistente IA — IGESDF - Licenciamento" },
      {
        property: "og:description",
        content: "Apoio de IA à redação de despachos e à análise de documentos de licenciamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Anexo = { nome: string; tipo: string; dados: string };
type Mensagem = { role: "user" | "assistant"; content: string; anexos?: Anexo[] };

const SUGESTOES = [
  "Redige um despacho de encaminhamento à VISADF solicitando análise de projeto arquitetônico de UPA.",
  "Qual a documentação exigida pelo CBMDF para a renovação do Atestado de Vistoria de um hospital?",
  "Monta um checklist de licenciamento para uma nova unidade administrativa de baixo risco no DF.",
];

const LIMITE_MB = 8;

/** Ações estruturadas aceites pelo servidor (a lista real vive em ia.server.ts). */
const ACOES = [
  ["pergunta_livre", "Pergunta livre"],
  ["resumo_unidade", "Resumo de unidade"],
  ["priorizar_pendencias", "Priorizar pendências"],
  ["explicar_exigencia", "Explicar exigência"],
] as const;

type Acao = (typeof ACOES)[number][0];

/** Mensagens por código de erro, para o utilizador saber o que fazer. */
function mensagemErro(status: number, texto: string): string {
  if (status === 403) return "Acesso restrito ao utilizador master.";
  if (status === 429)
    return "Limite de consultas de IA atingido. Tente novamente em alguns minutos.";
  if (status === 503) return "Serviço de IA temporariamente indisponível. Tente novamente.";
  if (status === 413) return "Pedido demasiado grande. Reduza o texto ou os anexos.";
  return texto || "Falha ao contactar o assistente.";
}

function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mt-1 h-7 px-2 text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(texto).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        });
      }}
    >
      {copiado ? (
        <Check className="mr-1 size-3" aria-hidden="true" />
      ) : (
        <Copy className="mr-1 size-3" aria-hidden="true" />
      )}
      {copiado ? "Copiado" : "Copiar resposta"}
    </Button>
  );
}

function lerFicheiro(f: File): Promise<Anexo> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error(`Não foi possível ler "${f.name}".`));
    leitor.onload = () =>
      resolve({
        nome: f.name,
        tipo: f.type || "application/octet-stream",
        dados: String(leitor.result),
      });
    leitor.readAsDataURL(f);
  });
}

function PaginaIA() {
  const ehMaster = useEhMaster();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [modelo, setModelo] = useState<"rapido" | "aprofundado">("rapido");
  const [acao, setAcao] = useState<Acao>("pergunta_livre");
  // "rede" = retrato de toda a rede; caso contrário o id da unidade a detalhar.
  const [escopo, setEscopo] = useState<string>("rede");
  const { data: unidades } = useQuery(unidadesQuery);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputFicheiro = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, ocupado]);

  if (!ehMaster) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Assistente IA" descricao="Área restrita ao utilizador master." />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Este módulo consome créditos de IA e está reservado ao utilizador master. Entre com a
            senha master para o utilizar.
          </CardContent>
        </Card>
      </div>
    );
  }

  async function anexar(lista: FileList | null) {
    if (!lista?.length) return;
    setErro(null);
    const novos: Anexo[] = [];
    for (const f of Array.from(lista)) {
      if (f.size > LIMITE_MB * 1024 * 1024) {
        setErro(`"${f.name}" excede ${LIMITE_MB} MB.`);
        continue;
      }
      try {
        novos.push(await lerFicheiro(f));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao ler o ficheiro.");
      }
    }
    setAnexos((a) => [...a, ...novos]);
    if (inputFicheiro.current) inputFicheiro.current.value = "";
  }

  async function enviar(conteudo: string) {
    const pergunta = conteudo.trim();
    if ((!pergunta && anexos.length === 0) || ocupado) return;
    setErro(null);
    const nova: Mensagem = {
      role: "user",
      content: pergunta,
      anexos: anexos.length ? anexos : undefined,
    };
    const historico = [...mensagens, nova];
    setMensagens([...historico, { role: "assistant", content: "" }]);
    setTexto("");
    setAnexos([]);
    setOcupado(true);

    try {
      // O endpoint valida o perfil master a partir do token da conta.
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessao } = await supabase.auth.getSession();
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessao.session?.access_token
            ? { Authorization: `Bearer ${sessao.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          mensagens: historico,
          modelo,
          acao,
          unidadeId: escopo === "rede" ? undefined : escopo,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(mensagemErro(res.status, await res.text().catch(() => "")));
      }
      const leitor = res.body.getReader();
      const decoder = new TextDecoder();
      let acumulado = "";
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        acumulado += decoder.decode(value, { stream: true });
        setMensagens((m) => {
          const copia = [...m];
          copia[copia.length - 1] = { role: "assistant", content: acumulado };
          return copia;
        });
      }
      if (!acumulado.trim()) {
        setMensagens((m) => {
          const copia = [...m];
          copia[copia.length - 1] = {
            role: "assistant",
            content: "_O assistente não devolveu resposta. Tente reformular a pergunta._",
          };
          return copia;
        });
      }
    } catch (e) {
      setMensagens((m) => m.slice(0, -1));
      setErro(e instanceof Error ? e.message : "Falha ao contactar o assistente.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Assistente IA"
        descricao="Apoio à redação de despachos e processos, interpretação de normativas e análise de documentos de licenciamento."
        acoes={
          <div className="flex flex-wrap gap-2">
            <BibliotecaModelos
              onUsar={(conteudo) =>
                setTexto(
                  `Usa este documento padrão como base e adapta ao caso que vou indicar:\n\n${conteudo}`,
                )
              }
            />
            {mensagens.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setMensagens([])}>
                <Trash2 className="mr-2 size-4" aria-hidden="true" /> Nova conversa
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Modo:</span>
        {(
          [
            ["rapido", "Rápido"],
            ["aprofundado", "Aprofundado"],
          ] as const
        ).map(([valor, rotulo]) => (
          <Button
            key={valor}
            type="button"
            size="sm"
            variant={modelo === valor ? "default" : "outline"}
            onClick={() => setModelo(valor)}
          >
            {rotulo}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Ação:</span>
        {ACOES.map(([valor, rotulo]) => (
          <Button
            key={valor}
            type="button"
            size="sm"
            variant={acao === valor ? "default" : "outline"}
            onClick={() => setAcao(valor)}
          >
            {rotulo}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Dados consultados:</span>
        <Select value={escopo} onValueChange={setEscopo}>
          <SelectTrigger className="h-8 w-72" aria-label="Escolher os dados enviados ao assistente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rede">Rede completa (indicadores e pendências)</SelectItem>
            {(unidades ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">
          O assistente recebe estes dados a cada pergunta. Dados pessoais são removidos.
        </span>
      </div>

      <Card className="flex h-[62vh] min-h-100 flex-col">
        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
          {mensagens.length === 0 && (
            <div className="space-y-4 py-8 text-center">
              <Sparkles className="mx-auto size-8 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Pergunte, peça um despacho ou anexe documentos para análise.
              </p>
              <div className="mx-auto grid max-w-2xl gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void enviar(s)}
                    className="rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div className="mt-1 shrink-0 rounded-full bg-muted p-1.5">
                {m.role === "user" ? (
                  <User className="size-4" aria-hidden="true" />
                ) : (
                  <Bot className="size-4 text-primary" aria-hidden="true" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.anexos && m.anexos.length > 0 && (
                  <ul className="mb-2 space-y-1 text-xs opacity-90">
                    {m.anexos.map((a) => (
                      <li key={a.nome} className="flex items-center gap-1">
                        <Paperclip className="size-3" aria-hidden="true" /> {a.nome}
                      </li>
                    ))}
                  </ul>
                )}
                {m.role === "assistant" ? (
                  m.content ? (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:block [&_table]:overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <BotaoCopiar texto={m.content} />
                        <GuardarModelo conteudo={m.content} />
                      </div>
                    </>
                  ) : (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={fimRef} />
        </CardContent>

        <div className="space-y-2 border-t p-3">
          {erro && (
            <p role="alert" className="text-xs text-destructive">
              {erro}
            </p>
          )}
          {anexos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {anexos.map((a, i) => (
                <li
                  key={`${a.nome}-${i}`}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                >
                  <Paperclip className="size-3" aria-hidden="true" />
                  <span className="max-w-40 truncate">{a.nome}</span>
                  <button
                    type="button"
                    aria-label={`Remover ${a.nome}`}
                    onClick={() => setAnexos((lista) => lista.filter((_, j) => j !== i))}
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(texto);
            }}
          >
            <input
              ref={inputFicheiro}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv"
              className="hidden"
              onChange={(e) => void anexar(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Adicionar documentos"
              onClick={() => inputFicheiro.current?.click()}
            >
              <Paperclip className="size-4" aria-hidden="true" />
            </Button>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Escreva a sua questão ou peça um despacho… (Enter envia, Shift+Enter quebra linha)"
              className="max-h-40 min-h-[44px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(texto);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar"
              disabled={ocupado || (!texto.trim() && anexos.length === 0)}
            >
              {ocupado ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground">
            Aceita PDF, imagens e texto até {LIMITE_MB} MB por ficheiro. Verifique sempre a base
            legal antes de protocolar documentos gerados.
          </p>
        </div>
      </Card>
    </div>
  );
}
