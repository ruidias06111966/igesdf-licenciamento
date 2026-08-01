import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DocRow, UploadDoc } from "@/components/documentos";
import { Field, FieldRow, FormSheet } from "@/components/form-sheet";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SITUACAO_ITEM_LABEL,
  formatDate,
  orgaoLabel,
  situacaoProcessoLabel,
  tipoProcessoLabel,
  type SituacaoItemProcesso,
} from "@/lib/domain";
import { mensagemErro } from "@/lib/errors";
import {
  deleteProcessoItem,
  gerarChecklistProcesso,
  setSituacaoItem,
  upsertProcessoItem,
} from "@/lib/processos.functions";
import { invalidarDados, processoQuery } from "@/lib/queries";
import type { Documento, ProcessoItem } from "@/lib/rows";

export const Route = createFileRoute("/_authenticated/processos/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(processoQuery(params.id)),
  component: ProcessoDetalhe,
  pendingComponent: () => <PageSkeleton />,
  head: () => ({
    meta: [
      { title: "Processo SEI — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Detalhe do processo SEI: checklist de documentação exigida, anexos do processo e situação junto do órgão.",
      },
      { property: "og:title", content: "Processo SEI — IGESDF" },
      {
        property: "og:description",
        content: "Documentação exigida e anexos de um processo SEI de licenciamento.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function ProcessoDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(processoQuery(id));
  const { processo, itens, documentos } = data;
  const unidadeId = processo.unidade_id;

  const gerar = useMutation({
    mutationFn: () => gerarChecklistProcesso({ data: { processo_id: id } }),
    onSuccess: () => {
      toast.success("Checklist gerado a partir do modelo do órgão");
      invalidarDados(qc);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  const semItem = documentos.filter((d) => !d.processo_item_id);

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        migalhas={[{ label: "Processos SEI", to: "/processos" }, { label: processo.numero }]}
        titulo={processo.assunto || tipoProcessoLabel(processo.tipo)}
        descricao={`${processo.unidades?.nome ?? "—"} · ${orgaoLabel(processo.orgao)} · ${situacaoProcessoLabel(processo.situacao)}${
          processo.data_abertura ? ` · aberto em ${formatDate(processo.data_abertura)}` : ""
        }`}
        acoes={
          <div className="flex flex-wrap gap-2">
            {processo.link && (
              <Button asChild variant="outline">
                <a href={processo.link} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 size-4" aria-hidden="true" /> Abrir no SEI
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              disabled={gerar.isPending}
              onClick={() => gerar.mutate()}
              title="Cria os documentos exigidos pelo órgão deste processo"
            >
              <ListChecks className="mr-1 size-4" aria-hidden="true" /> Gerar checklist do órgão
            </Button>
            <ItemForm
              processoId={id}
              ordem={itens.length + 1}
              trigger={
                <Button>
                  <Plus className="mr-1 size-4" aria-hidden="true" /> Novo documento exigido
                </Button>
              }
            />
          </div>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Documentação exigida ({itens.length})</h2>
        {itens.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                titulo="Checklist vazio"
                descricao="Gere o checklist a partir do modelo do órgão ou adicione os documentos manualmente."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {itens.map((item) => (
              <ItemLinha
                key={item.id}
                item={item}
                unidadeId={unidadeId}
                processoId={id}
                documentos={documentos.filter((d) => d.processo_item_id === item.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Anexos gerais do processo ({semItem.length})</h2>
        <UploadDoc unidadeId={unidadeId} processoId={id} rotulo="Anexar ao processo" />
        {semItem.map((d) => (
          <DocRow
            key={d.id}
            documento={d}
            unidadeId={unidadeId}
            onChange={() => invalidarDados(qc)}
          />
        ))}
        {semItem.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum anexo geral. Use o checklist acima para anexar cada documento exigido.
          </p>
        )}
      </section>

      {processo.observacoes && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Observações</h2>
          <p className="rounded-md border p-3 text-sm text-muted-foreground">
            {processo.observacoes}
          </p>
        </section>
      )}
    </div>
  );
}

function toneSituacao(s: string): string {
  if (s === "entregue") return "bg-success/15 text-success";
  if (s === "dispensado") return "bg-muted text-muted-foreground";
  if (s === "em_curso") return "bg-info/15 text-info";
  return "bg-warning/20 text-warning-foreground";
}

function ItemLinha({
  item,
  unidadeId,
  processoId,
  documentos,
}: {
  item: ProcessoItem;
  unidadeId: string;
  processoId: string;
  documentos: Documento[];
}) {
  const qc = useQueryClient();
  const mudar = useMutation({
    mutationFn: (situacao: SituacaoItemProcesso) =>
      setSituacaoItem({ data: { id: item.id, situacao } }),
    onSuccess: () => invalidarDados(qc),
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{item.titulo}</span>
            <Badge className={`border-0 text-[10px] ${toneSituacao(item.situacao)}`}>
              {SITUACAO_ITEM_LABEL[item.situacao as SituacaoItemProcesso] ?? item.situacao}
            </Badge>
            {!item.obrigatorio && (
              <Badge variant="outline" className="text-[10px]">
                Opcional
              </Badge>
            )}
          </div>
          {item.descricao && (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.descricao}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.responsavel ? `Responsável: ${item.responsavel}` : "Sem responsável"}
            {item.prazo ? ` · prazo ${formatDate(item.prazo)}` : ""}
            {item.data_entrega ? ` · entregue em ${formatDate(item.data_entrega)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Select
            value={item.situacao}
            onValueChange={(v) => mudar.mutate(v as SituacaoItemProcesso)}
          >
            <SelectTrigger className="h-8 w-[150px]" aria-label={`Situação de ${item.titulo}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SITUACAO_ITEM_LABEL).map(([chave, rotulo]) => (
                <SelectItem key={chave} value={chave}>
                  {rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <UploadDoc
            unidadeId={unidadeId}
            processoId={processoId}
            processoItemId={item.id}
            rotulo="Anexar"
          />
          <ItemForm
            processoId={processoId}
            item={item}
            ordem={item.ordem}
            trigger={
              <Button size="sm" variant="ghost">
                Editar
              </Button>
            }
          />
          <ConfirmDelete
            titulo="Excluir item do checklist"
            descricao="O item deixa de ser exigido neste processo."
            mensagemSucesso="Item excluído"
            onConfirm={() => deleteProcessoItem({ data: { id: item.id } })}
            onDone={() => invalidarDados(qc)}
          />
        </div>
      </div>
      {documentos.length > 0 && (
        <div className="space-y-2 border-t pt-2">
          {documentos.map((d) => (
            <DocRow
              key={d.id}
              documento={d}
              unidadeId={unidadeId}
              onChange={() => invalidarDados(qc)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ValoresItem = {
  id?: string;
  processo_id: string;
  titulo: string;
  descricao: string;
  obrigatorio: boolean;
  ordem: number;
  situacao: SituacaoItemProcesso;
  responsavel: string;
  prazo: string;
  data_entrega: string;
  observacoes: string;
};

function ItemForm({
  processoId,
  item,
  ordem,
  trigger,
}: {
  processoId: string;
  item?: ProcessoItem;
  ordem: number;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: (v: ValoresItem) => upsertProcessoItem({ data: v }),
    onSuccess: () => {
      toast.success(item ? "Item atualizado" : "Item adicionado");
      invalidarDados(qc);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<ValoresItem>
      titulo={item ? "Editar documento exigido" : "Novo documento exigido"}
      descricao="Documento que precisa ser juntado ao processo no SEI."
      trigger={trigger}
      valorInicial={() => ({
        id: item?.id,
        processo_id: processoId,
        titulo: item?.titulo ?? "",
        descricao: item?.descricao ?? "",
        obrigatorio: item?.obrigatorio ?? true,
        ordem: item?.ordem ?? ordem,
        situacao: (item?.situacao ?? "pendente") as SituacaoItemProcesso,
        responsavel: item?.responsavel ?? "",
        prazo: item?.prazo ?? "",
        data_entrega: item?.data_entrega ?? "",
        observacoes: item?.observacoes ?? "",
      })}
      podeSalvar={(v) => v.titulo.trim().length >= 2}
      onSubmit={(v) => salvar.mutateAsync(v)}
    >
      {(v, definir) => (
        <>
          <Field label="Documento" obrigatorio htmlFor="item-titulo">
            <Input
              id="item-titulo"
              required
              value={v.titulo}
              onChange={(e) => definir("titulo", e.target.value)}
            />
          </Field>
          <Field label="Descrição" htmlFor="item-descricao">
            <Textarea
              id="item-descricao"
              rows={2}
              value={v.descricao}
              onChange={(e) => definir("descricao", e.target.value)}
            />
          </Field>
          <FieldRow>
            <Field label="Situação" htmlFor="item-situacao">
              <Select
                value={v.situacao}
                onValueChange={(valor) => definir("situacao", valor as SituacaoItemProcesso)}
              >
                <SelectTrigger id="item-situacao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SITUACAO_ITEM_LABEL).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsável" htmlFor="item-responsavel">
              <Input
                id="item-responsavel"
                value={v.responsavel}
                onChange={(e) => definir("responsavel", e.target.value)}
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Prazo" htmlFor="item-prazo">
              <Input
                id="item-prazo"
                type="date"
                value={v.prazo}
                onChange={(e) => definir("prazo", e.target.value)}
              />
            </Field>
            <Field label="Data de entrega" htmlFor="item-entrega">
              <Input
                id="item-entrega"
                type="date"
                value={v.data_entrega}
                onChange={(e) => definir("data_entrega", e.target.value)}
              />
            </Field>
          </FieldRow>
          <Field label="Observações" htmlFor="item-obs">
            <Textarea
              id="item-obs"
              rows={2}
              value={v.observacoes}
              onChange={(e) => definir("observacoes", e.target.value)}
            />
          </Field>
        </>
      )}
    </FormSheet>
  );
}
