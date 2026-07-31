import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileDown, MapPin, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/states";
import { ConfirmDelete } from "@/components/confirm-delete";
import { UnidadeForm } from "@/components/forms/unidade-form";
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
import { deleteUnidade } from "@/lib/licencas.functions";
import { invalidarDados, unidadesQuery } from "@/lib/queries";
import { TIPO_UNIDADE_LABEL, situacaoEdificacaoLabel, tipoUnidadeLabel } from "@/lib/domain";
import type { Unidade } from "@/lib/rows";

export const Route = createFileRoute("/_authenticated/unidades/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(unidadesQuery),
  component: UnidadesPage,
  pendingComponent: () => <CardGridSkeleton itens={6} />,
  head: () => ({
    meta: [
      { title: "Unidades — IGESDF Compliance" },
      {
        name: "description",
        content:
          "Cadastro das unidades hospitalares e UPAs do IGESDF, com CNPJ, CF/DF, processo SEI e situação de licenciamento por órgão.",
      },
      { property: "og:title", content: "Unidades — IGESDF Compliance" },
      {
        property: "og:description",
        content: "Hospitais e UPAs da rede IGESDF e o respectivo estado de licenciamento.",
      },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/unidades" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/unidades" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function UnidadesPage() {
  const { data } = useSuspenseQuery(unidadesQuery);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");

  const temFiltro = busca !== "" || tipo !== "todos";

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return data.filter((u) => {
      if (tipo !== "todos" && u.tipo !== tipo) return false;
      if (!termo) return true;
      const alvo = [u.nome, u.cnpj, u.regiao_administrativa, u.processo_sei, u.numero_iges]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [data, busca, tipo]);

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Unidades"
        descricao={
          temFiltro
            ? `${filtradas.length} de ${data.length} unidades.`
            : `${data.length} unidades cadastradas na rede IGESDF.`
        }
        acoes={
          <UnidadeForm
            trigger={
              <Button>
                <Plus className="mr-1 size-4" aria-hidden="true" /> Nova unidade
              </Button>
            }
          />
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CNPJ, região ou nº IGES…"
            aria-label="Buscar unidades"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="sm:w-52" aria-label="Filtrar por tipo de unidade">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPO_UNIDADE_LABEL).map(([chave, rotulo]) => (
              <SelectItem key={chave} value={chave}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              titulo={
                data.length === 0 ? "Nenhuma unidade cadastrada" : "Nenhuma unidade encontrada"
              }
              descricao={
                data.length === 0
                  ? "Comece cadastrando um hospital ou UPA para montar a matriz de licenciamento."
                  : "Ajuste a busca ou o filtro de tipo."
              }
              acao={
                data.length === 0 ? (
                  <UnidadeForm
                    trigger={
                      <Button size="sm">
                        <Plus className="mr-1 size-4" aria-hidden="true" /> Nova unidade
                      </Button>
                    }
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBusca("");
                      setTipo("todos");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((u) => (
            <UnidadeCard key={u.id} unidade={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function UnidadeCard({ unidade }: { unidade: Unidade }) {
  const qc = useQueryClient();
  const invalidar = () => invalidarDados(qc);

  return (
    <Card className="flex h-full flex-col transition-colors hover:border-primary/50">
      <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <Link to="/unidades/$id" params={{ id: unidade.id }} className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Nº {unidade.numero_iges ?? "—"}</div>
            <div className="font-semibold leading-tight hover:underline">{unidade.nome}</div>
          </Link>
          <Badge variant="secondary" className="shrink-0">
            {tipoUnidadeLabel(unidade.tipo)}
          </Badge>
        </div>

        <dl className="flex-1 space-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5">
            <dt className="shrink-0">CNPJ:</dt>
            <dd className="truncate font-mono">{unidade.cnpj ?? "—"}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="shrink-0">Edificação:</dt>
            <dd>{situacaoEdificacaoLabel(unidade.situacao_edificacao)}</dd>
          </div>
          {unidade.endereco && (
            <div className="flex gap-1.5">
              <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <dd className="line-clamp-2">
                {unidade.endereco}
                {unidade.regiao_administrativa ? ` — ${unidade.regiao_administrativa}` : ""}
              </dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap justify-end gap-1 border-t pt-2">
          <Button asChild size="sm" variant="ghost">
            <Link to="/unidades/$id/dossie" params={{ id: unidade.id }} search={{ print: 1 }}>
              <FileDown className="mr-1 size-3.5" aria-hidden="true" /> Dossiê PDF
            </Link>
          </Button>
          <UnidadeForm
            unidade={unidade}
            trigger={
              <Button size="sm" variant="ghost">
                <Pencil className="mr-1 size-3.5" aria-hidden="true" /> Editar
              </Button>
            }
          />
          <ConfirmDelete
            titulo="Desativar unidade"
            descricao="A unidade sai do cadastro e as suas licenças deixam de contar nos painéis e relatórios. O histórico de licenças, CNAEs e documentos é preservado."
            rotuloConfirmar="Desativar"
            mensagemSucesso="Unidade desativada"
            onConfirm={() => deleteUnidade({ data: { id: unidade.id } })}
            onDone={invalidar}
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                Desativar
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
