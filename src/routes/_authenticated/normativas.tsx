import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  BookText,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  Printer,
  Search,
  Star,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/states";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Field, FieldRow, FormSheet } from "@/components/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { enviarArquivo, signedDocUrl } from "@/lib/licencas.functions";
import { deleteNormativa, upsertNormativa } from "@/lib/normativas.functions";
import { invalidarDados, normativasQuery } from "@/lib/queries";
import { formatDate } from "@/lib/dates";
import { mensagemErro } from "@/lib/errors";
import type { Normativa } from "@/lib/rows";

const TIPOS = [
  { value: "rdc", label: "RDC (ANVISA)" },
  { value: "normativa", label: "Normativa / Nota técnica" },
  { value: "portaria", label: "Portaria" },
  { value: "instrucao_normativa", label: "Instrução normativa" },
  { value: "resolucao", label: "Resolução" },
  { value: "lei", label: "Lei" },
  { value: "decreto", label: "Decreto" },
  { value: "processo_sei", label: "Processo SEI" },
  { value: "outro", label: "Outro" },
] as const;

const SITUACOES = [
  { value: "vigente", label: "Vigente" },
  { value: "revogada", label: "Revogada" },
  { value: "substituida", label: "Substituída" },
  { value: "em_consulta", label: "Em consulta pública" },
] as const;

const AMBITOS = [
  { value: "federal", label: "Federal" },
  { value: "distrital", label: "Distrital (DF)" },
  { value: "interno", label: "Interno (IGESDF)" },
] as const;

const APLICACOES = ["UPAs", "Hospitais", "Administrativo", "Laboratório"];

type Tipo = (typeof TIPOS)[number]["value"];
type Situacao = (typeof SITUACOES)[number]["value"];
type Ambito = (typeof AMBITOS)[number]["value"];

const rotulo = (lista: readonly { value: string; label: string }[], valor: string | null) =>
  lista.find((i) => i.value === valor)?.label ?? valor ?? "—";

export const Route = createFileRoute("/_authenticated/normativas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(normativasQuery),
  component: NormativasPage,
  pendingComponent: () => <CardGridSkeleton itens={5} />,
  head: () => ({
    meta: [
      { title: "Normativas e processos SEI — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Arquivo de RDCs da ANVISA, normativas da VISADF, portarias, leis e processos SEI aplicáveis ao licenciamento de UPAs e hospitais do IGESDF.",
      },
      { property: "og:title", content: "Normativas, portarias e processos SEI — IGESDF" },
      {
        property: "og:description",
        content: "Base legal do licenciamento sanitário e ambiental das unidades do IGESDF.",
      },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/normativas" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/normativas" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function NormativasPage() {
  const { data } = useSuspenseQuery(normativasQuery);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [ambito, setAmbito] = useState("todos");
  const [aplicacao, setAplicacao] = useState("todas");

  const temFiltro = busca !== "" || tipo !== "todos" || ambito !== "todos" || aplicacao !== "todas";

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return data.filter((n) => {
      if (tipo !== "todos" && n.tipo !== tipo) return false;
      if (ambito !== "todos" && n.ambito !== ambito) return false;
      if (aplicacao !== "todas" && !(n.aplicacao ?? []).includes(aplicacao)) return false;
      if (!termo) return true;
      const alvo = [n.tipo, n.numero, n.ano, n.orgao_sigla, n.titulo, n.ementa, ...(n.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [data, busca, tipo, ambito, aplicacao]);

  function limpar() {
    setBusca("");
    setTipo("todos");
    setAmbito("todos");
    setAplicacao("todas");
  }

  return (
    <div className="print-area space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Normativas, portarias e processos SEI"
        descricao={
          temFiltro
            ? `${filtradas.length} de ${data.length} documentos normativos.`
            : `${data.length} documentos normativos arquivados.`
        }
        acoes={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 size-4" aria-hidden="true" /> Imprimir / PDF
            </Button>
            <NormativaForm
              trigger={
                <Button>
                  <Plus className="mr-1 size-4" aria-hidden="true" /> Nova normativa
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-3 no-print md:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Buscar número, título, ementa…"
            aria-label="Buscar normativas"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger aria-label="Filtrar por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ambito} onValueChange={setAmbito}>
          <SelectTrigger aria-label="Filtrar por âmbito">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os âmbitos</SelectItem>
            {AMBITOS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select value={aplicacao} onValueChange={setAplicacao}>
            <SelectTrigger aria-label="Filtrar por aplicação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as aplicações</SelectItem>
              {APLICACOES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {temFiltro && (
            <Button variant="ghost" onClick={limpar} className="shrink-0">
              Limpar
            </Button>
          )}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icone={<BookText className="size-5" aria-hidden="true" />}
              titulo={
                data.length === 0 ? "Nenhuma normativa arquivada" : "Nenhum documento encontrado"
              }
              descricao={
                data.length === 0
                  ? "Arquive as RDCs, instruções normativas e processos SEI que sustentam cada licenciamento."
                  : "Ajuste a busca ou os filtros."
              }
              acao={
                data.length === 0 ? (
                  <NormativaForm
                    trigger={
                      <Button size="sm">
                        <Plus className="mr-1 size-4" aria-hidden="true" /> Nova normativa
                      </Button>
                    }
                  />
                ) : (
                  <Button size="sm" variant="outline" onClick={limpar}>
                    Limpar filtros
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtradas.map((n) => (
            <NormativaCard key={n.id} normativa={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function NormativaCard({ normativa: n }: { normativa: Normativa }) {
  const qc = useQueryClient();

  async function baixar() {
    if (!n.storage_path) return;
    try {
      const { url } = await signedDocUrl({ data: { path: n.storage_path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (erro) {
      toast.error(mensagemErro(erro));
    }
  }

  return (
    <Card className={n.principal ? "border-primary" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {n.principal && (
                <Badge className="gap-1">
                  <Star className="size-3" aria-hidden="true" /> Principal
                </Badge>
              )}
              <Badge variant="secondary" className="font-mono text-xs">
                {n.orgao_sigla}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {rotulo(TIPOS, n.tipo)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {rotulo(AMBITOS, n.ambito)}
              </Badge>
              <Badge
                variant={n.situacao === "vigente" ? "secondary" : "outline"}
                className="text-xs"
              >
                {rotulo(SITUACOES, n.situacao)}
              </Badge>
            </div>

            <h2 className="leading-tight font-medium">
              {rotulo(TIPOS, n.tipo).split(" ")[0]} nº {n.numero}
              {n.ano ? `/${n.ano}` : ""} — {n.titulo}
            </h2>

            {n.ementa && <p className="text-sm text-muted-foreground">{n.ementa}</p>}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {n.data_publicacao && <span>Publicação: {formatDate(n.data_publicacao)}</span>}
              {(n.aplicacao ?? []).length > 0 && (
                <span>Aplica-se a: {(n.aplicacao ?? []).join(", ")}</span>
              )}
              {(n.tags ?? []).length > 0 && <span>Etiquetas: {(n.tags ?? []).join(", ")}</span>}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              {n.link && (
                <a
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  <ExternalLink className="size-3" aria-hidden="true" /> Texto oficial
                </a>
              )}
              {n.storage_path && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 underline no-print"
                  onClick={() => void baixar()}
                >
                  <Download className="size-3" aria-hidden="true" /> Arquivo anexado
                </button>
              )}
            </div>

            {n.observacoes && (
              <p className="text-xs text-muted-foreground italic">{n.observacoes}</p>
            )}
          </div>

          <div className="flex shrink-0 gap-1 no-print">
            <NormativaForm
              normativa={n}
              trigger={
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar nº ${n.numero}`}
                  title="Editar"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <ConfirmDelete
              titulo={`Excluir nº ${n.numero}?`}
              descricao="Esta ação é permanente e remove também o arquivo anexado."
              mensagemSucesso="Normativa excluída"
              onConfirm={() =>
                deleteNormativa({ data: { id: n.id, storage_path: n.storage_path ?? null } })
              }
              onDone={() => invalidarDados(qc)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ValoresNormativa = {
  id?: string;
  tipo: Tipo;
  numero: string;
  ano: string;
  orgao_sigla: string;
  titulo: string;
  ementa: string;
  ambito: Ambito;
  aplicacao: string[];
  data_publicacao: string;
  situacao: Situacao;
  link: string;
  storage_path: string | null;
  tags: string;
  principal: boolean;
  observacoes: string;
};

function NormativaForm({ normativa, trigger }: { normativa?: Normativa; trigger: ReactNode }) {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);

  const salvar = useMutation({
    mutationFn: (v: ValoresNormativa) =>
      upsertNormativa({
        data: {
          ...v,
          ano: v.ano ? Number(v.ano) : null,
          tags: v.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success(normativa ? "Normativa atualizada" : "Normativa cadastrada");
      invalidarDados(qc);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<ValoresNormativa>
      titulo={normativa ? "Editar normativa" : "Nova normativa"}
      descricao="Base legal e processos SEI que sustentam o licenciamento."
      trigger={trigger}
      valorInicial={() => ({
        id: normativa?.id,
        tipo: (normativa?.tipo ?? "rdc") as Tipo,
        numero: normativa?.numero ?? "",
        ano: normativa?.ano?.toString() ?? new Date().getFullYear().toString(),
        orgao_sigla: normativa?.orgao_sigla ?? "ANVISA",
        titulo: normativa?.titulo ?? "",
        ementa: normativa?.ementa ?? "",
        ambito: (normativa?.ambito ?? "federal") as Ambito,
        aplicacao: normativa?.aplicacao ?? [],
        data_publicacao: normativa?.data_publicacao ?? "",
        situacao: (normativa?.situacao ?? "vigente") as Situacao,
        link: normativa?.link ?? "",
        storage_path: normativa?.storage_path ?? null,
        tags: (normativa?.tags ?? []).join(", "),
        principal: normativa?.principal ?? false,
        observacoes: normativa?.observacoes ?? "",
      })}
      podeSalvar={(v) =>
        !enviando &&
        v.numero.trim().length >= 1 &&
        v.titulo.trim().length >= 3 &&
        v.orgao_sigla.trim().length >= 2
      }
      onSubmit={(v) => salvar.mutateAsync(v)}
    >
      {(v, definir) => {
        async function anexar(arquivo: File | undefined) {
          if (!arquivo) return;
          setEnviando(true);
          try {
            const formulario = new FormData();
            formulario.append("arquivo", arquivo);
            formulario.append("prefixo", "normativas");
            const enviado = await enviarArquivo({ data: formulario });
            definir("storage_path", enviado.storage_path);
            toast.success("Arquivo anexado");
          } catch (erro) {
            toast.error(mensagemErro(erro));
          } finally {
            setEnviando(false);
          }
        }

        function alternarAplicacao(item: string) {
          const atual = v.aplicacao;
          definir(
            "aplicacao",
            atual.includes(item) ? atual.filter((x) => x !== item) : [...atual, item],
          );
        }

        return (
          <>
            <FieldRow>
              <Field label="Tipo" obrigatorio htmlFor="norm-tipo">
                <Select value={v.tipo} onValueChange={(valor) => definir("tipo", valor as Tipo)}>
                  <SelectTrigger id="norm-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Órgão emissor" obrigatorio htmlFor="norm-orgao">
                <Input
                  id="norm-orgao"
                  required
                  value={v.orgao_sigla}
                  onChange={(e) => definir("orgao_sigla", e.target.value.toUpperCase())}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Número" obrigatorio htmlFor="norm-numero">
                <Input
                  id="norm-numero"
                  required
                  value={v.numero}
                  onChange={(e) => definir("numero", e.target.value)}
                />
              </Field>
              <Field label="Ano" htmlFor="norm-ano">
                <Input
                  id="norm-ano"
                  type="number"
                  inputMode="numeric"
                  value={v.ano}
                  onChange={(e) => definir("ano", e.target.value)}
                />
              </Field>
            </FieldRow>

            <Field label="Título" obrigatorio htmlFor="norm-titulo">
              <Input
                id="norm-titulo"
                required
                value={v.titulo}
                onChange={(e) => definir("titulo", e.target.value)}
              />
            </Field>

            <Field label="Ementa" htmlFor="norm-ementa">
              <Textarea
                id="norm-ementa"
                rows={4}
                value={v.ementa}
                onChange={(e) => definir("ementa", e.target.value)}
              />
            </Field>

            <FieldRow>
              <Field label="Âmbito" obrigatorio htmlFor="norm-ambito">
                <Select
                  value={v.ambito}
                  onValueChange={(valor) => definir("ambito", valor as Ambito)}
                >
                  <SelectTrigger id="norm-ambito">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AMBITOS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Situação" obrigatorio htmlFor="norm-situacao">
                <Select
                  value={v.situacao}
                  onValueChange={(valor) => definir("situacao", valor as Situacao)}
                >
                  <SelectTrigger id="norm-situacao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITUACOES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldRow>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">Aplica-se a</legend>
              <div className="flex flex-wrap gap-4">
                {APLICACOES.map((a) => (
                  <div key={a} className="flex items-center gap-2">
                    <Checkbox
                      id={`norm-aplic-${a}`}
                      checked={v.aplicacao.includes(a)}
                      onCheckedChange={() => alternarAplicacao(a)}
                    />
                    <Label htmlFor={`norm-aplic-${a}`} className="text-sm font-normal">
                      {a}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>

            <FieldRow>
              <Field label="Data de publicação" htmlFor="norm-pub">
                <Input
                  id="norm-pub"
                  type="date"
                  value={v.data_publicacao}
                  onChange={(e) => definir("data_publicacao", e.target.value)}
                />
              </Field>
              <Field label="Etiquetas" htmlFor="norm-tags" dica="Separadas por vírgula.">
                <Input
                  id="norm-tags"
                  value={v.tags}
                  onChange={(e) => definir("tags", e.target.value)}
                  placeholder="pgrss, resíduos, risco III"
                />
              </Field>
            </FieldRow>

            <Field label="Link oficial" htmlFor="norm-link">
              <Input
                id="norm-link"
                value={v.link}
                onChange={(e) => definir("link", e.target.value)}
                placeholder="https://…"
              />
            </Field>

            <Field label="Arquivo (PDF ou imagem)" htmlFor="norm-arquivo">
              <Input
                id="norm-arquivo"
                type="file"
                accept="application/pdf,image/*"
                disabled={enviando}
                onChange={(e) => void anexar(e.target.files?.[0])}
              />
              {enviando && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <Upload className="mr-1 inline size-3" aria-hidden="true" />
                  Enviando…
                </p>
              )}
              {v.storage_path && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Anexo: {v.storage_path.split("/").pop()}
                </p>
              )}
            </Field>

            <Field label="Observações" htmlFor="norm-obs">
              <Textarea
                id="norm-obs"
                rows={2}
                value={v.observacoes}
                onChange={(e) => definir("observacoes", e.target.value)}
              />
            </Field>

            <div className="flex items-center gap-2">
              <Checkbox
                id="norm-principal"
                checked={v.principal}
                onCheckedChange={(marcado) => definir("principal", marcado === true)}
              />
              <Label htmlFor="norm-principal" className="text-sm font-normal">
                Marcar como normativa principal de licenciamento
              </Label>
            </div>
          </>
        );
      }}
    </FormSheet>
  );
}
