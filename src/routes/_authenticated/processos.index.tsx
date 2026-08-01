import { queryOptions as _qo, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, FolderOpen, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PageHeader } from "@/components/page-header";
import { ProcessoForm } from "@/components/forms/processo-form";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/states";
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
import { formatDate, orgaoLabel, situacaoProcessoLabel, tipoProcessoLabel } from "@/lib/domain";
import { deleteProcesso } from "@/lib/processos.functions";
import { invalidarDados, processosQuery, unidadesQuery } from "@/lib/queries";
import type { ProcessoLista } from "@/lib/rows";

export const Route = createFileRoute("/_authenticated/processos/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(processosQuery),
      context.queryClient.ensureQueryData(unidadesQuery),
    ]);
  },
  component: ProcessosPage,
  pendingComponent: () => <CardGridSkeleton itens={6} />,
  head: () => ({
    meta: [
      { title: "Processos SEI — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Controle dos processos SEI de licenciamento por unidade: documentos exigidos, anexos e acompanhamento junto de cada órgão.",
      },
      { property: "og:title", content: "Processos SEI — IGESDF" },
      {
        property: "og:description",
        content: "Acompanhamento dos processos SEI de licenciamento das unidades do IGESDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/processos" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/processos" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function ProcessosPage() {
  const { data } = useSuspenseQuery(processosQuery);
  const { data: unidades } = useSuspenseQuery(unidadesQuery);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState("todas");
  const [situacao, setSituacao] = useState("todas");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return data.filter((p) => {
      if (unidade !== "todas" && p.unidade_id !== unidade) return false;
      if (situacao !== "todas" && p.situacao !== situacao) return false;
      if (!termo) return true;
      return [p.numero, p.assunto, p.responsavel, p.unidades?.nome, orgaoLabel(p.orgao)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(termo);
    });
  }, [data, busca, unidade, situacao]);

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Processos SEI"
        descricao={`${filtrados.length} de ${data.length} processos.`}
        acoes={
          <ProcessoForm
            unidades={unidades}
            trigger={
              <Button>
                <Plus className="mr-1 size-4" aria-hidden="true" /> Novo processo
              </Button>
            }
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Buscar por número SEI, assunto, unidade…"
            aria-label="Buscar processos"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={unidade} onValueChange={setUnidade}>
          <SelectTrigger aria-label="Filtrar por unidade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as unidades</SelectItem>
            {unidades.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="aguardando_orgao">Aguardando órgão</SelectItem>
            <SelectItem value="exigencia">Com exigência</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="arquivado">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icone={<FolderOpen className="size-5" aria-hidden="true" />}
              titulo={data.length === 0 ? "Nenhum processo SEI" : "Nenhum processo encontrado"}
              descricao={
                data.length === 0
                  ? "Cadastre o número do processo SEI de cada unidade e acompanhe a documentação exigida pelo órgão."
                  : "Ajuste os filtros ou o termo de busca."
              }
              acao={
                data.length === 0 ? (
                  <ProcessoForm
                    unidades={unidades}
                    trigger={
                      <Button size="sm">
                        <Plus className="mr-1 size-4" aria-hidden="true" /> Novo processo
                      </Button>
                    }
                  />
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((p) => (
            <ProcessoCard key={p.id} processo={p} unidades={unidades} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessoCard({
  processo,
  unidades,
}: {
  processo: ProcessoLista;
  unidades: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const { total, concluidos } = processo.resumo;
  const percentagem = total ? Math.round((concluidos / total) * 100) : 0;

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="font-mono text-xs">
                {processo.numero}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {situacaoProcessoLabel(processo.situacao)}
              </Badge>
              {processo.orgao && (
                <Badge className="border-0 bg-info/15 text-[10px] text-info">
                  {orgaoLabel(processo.orgao)}
                </Badge>
              )}
            </div>
            <Link
              to="/processos/$id"
              params={{ id: processo.id }}
              className="mt-1 block leading-tight font-medium hover:underline"
            >
              {processo.assunto || tipoProcessoLabel(processo.tipo)}
            </Link>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {processo.unidades?.nome ?? "—"}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <ProcessoForm
              processo={processo}
              unidades={unidades}
              trigger={
                <Button size="icon" variant="ghost" aria-label="Editar processo" title="Editar">
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <ConfirmDelete
              titulo={`Excluir processo ${processo.numero}?`}
              descricao="O checklist e os anexos ligados a este processo também são removidos."
              mensagemSucesso="Processo excluído"
              onConfirm={() => deleteProcesso({ data: { id: processo.id } })}
              onDone={() => invalidarDados(qc)}
            />
          </div>
        </div>

        <div className="flex-1 space-y-1 text-xs text-muted-foreground">
          <div>
            Abertura {formatDate(processo.data_abertura)}
            {processo.responsavel ? ` · ${processo.responsavel}` : ""}
          </div>
          {processo.link && (
            <div className="flex items-center gap-1.5">
              <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
              <a
                href={processo.link}
                target="_blank"
                rel="noreferrer"
                className="truncate underline"
              >
                Abrir no SEI
              </a>
            </div>
          )}
        </div>

        <div className="space-y-1 border-t pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Documentação</span>
            <span className="font-medium">
              {concluidos}/{total || 0}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percentagem}%` }} />
          </div>
          <Button asChild size="sm" variant="outline" className="mt-1 w-full">
            <Link to="/processos/$id" params={{ id: processo.id }}>
              Abrir processo
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
