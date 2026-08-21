import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Grid3x3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { TableScroll } from "@/components/data-table";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { licencasQuery, unidadesQuery } from "@/lib/queries";
import {
  ORGAOS,
  TIPO_UNIDADE_LABEL,
  orgaoLabel,
  semaforoColor,
  statusLabel,
  tipoUnidadeLabel,
} from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { sufixoData, type ColunaCsv } from "@/lib/csv";
import { BotaoExportar } from "@/components/botao-exportar";
import { montarGrade, temPendencia, type Celula } from "@/lib/matriz";
import type { Unidade } from "@/lib/rows";
import { cn } from "@/lib/utils";
import { SubNav } from "@/components/sub-nav";

export const Route = createFileRoute("/_authenticated/matriz")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(licencasQuery),
      context.queryClient.ensureQueryData(unidadesQuery),
    ]),
  component: MatrizPage,
  pendingComponent: () => <PageSkeleton colunas={8} linhas={10} />,
  head: () => ({
    meta: [
      { title: "Matriz de compliance — IGESDF" },
      {
        name: "description",
        content:
          "Matriz cruzada unidade × órgão licenciador: situação, vencimento e pendências de cada licença da rede IGESDF numa única visão.",
      },
      { property: "og:title", content: "Matriz de compliance — IGESDF" },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/matriz" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/matriz" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function MatrizPage() {
  const { data: licencas } = useSuspenseQuery(licencasQuery);
  const { data: unidades } = useSuspenseQuery(unidadesQuery);
  const [tipoF, setTipoF] = useState("todos");
  const [apenasPendencias, setApenasPendencias] = useState(false);

  const unidadesFiltradas = useMemo(
    () => unidades.filter((u) => tipoF === "todos" || u.tipo === tipoF),
    [unidades, tipoF],
  );

  /** Só as colunas de órgãos que têm alguma licença — evita 19 colunas vazias. */
  const orgaosUsados = useMemo(() => {
    const presentes = new Set(licencas.map((l) => l.orgao).filter(Boolean) as string[]);
    return ORGAOS.filter((o) => presentes.has(o.value));
  }, [licencas]);

  const grade = useMemo(() => montarGrade(licencas), [licencas]);

  const linhas = useMemo(() => {
    if (!apenasPendencias) return unidadesFiltradas;
    const codigos = orgaosUsados.map((o) => o.value);
    return unidadesFiltradas.filter((u) => temPendencia(u.id, grade, codigos));
  }, [unidadesFiltradas, grade, orgaosUsados, apenasPendencias]);

  const colunasCsv: ColunaCsv<Unidade>[] = useMemo(
    () => [
      { cabecalho: "Unidade", valor: (u) => u.nome },
      { cabecalho: "Tipo", valor: (u) => tipoUnidadeLabel(u.tipo) },
      { cabecalho: "Região", valor: (u) => u.regiao_administrativa },
      ...orgaosUsados.map((o) => ({
        cabecalho: o.label,
        valor: (u: Unidade) => {
          const celula = grade.get(u.id)?.get(o.value);
          if (!celula?.pior) return "sem registo";
          const tom = semaforoColor(celula.pior.semaforo ?? "");
          const venc = celula.pior.data_vencimento
            ? ` até ${formatDate(celula.pior.data_vencimento)}`
            : "";
          const extra = celula.licencas.length > 1 ? ` (${celula.licencas.length} licenças)` : "";
          return `${tom.label}${venc}${extra}`;
        },
        situacao: true,
      })),
    ],
    [orgaosUsados, grade],
  );

  return (
    <div className="print-area space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Matriz de compliance"
        descricao={`${linhas.length} unidade(s) × ${orgaosUsados.length} órgão(s). Cada célula mostra a licença mais urgente do cruzamento.`}
        acoes={
          <>
            <BotaoExportar
              nomeArquivo={`matriz-compliance-igesdf-${sufixoData()}`}
              titulo="IGESDF — Matriz de compliance"
              subtitulo={`${linhas.length} unidade(s) × ${orgaosUsados.length} órgão(s)`}
              folha="Matriz"
              linhas={linhas}
              colunas={colunasCsv}
              rotulo="Exportar planilha"
            />
            <PrintModeToggle defaultOrientation="landscape" />
          </>
        }
      />
      <SubNav grupo="licencas" />

      <div className="flex flex-wrap items-center gap-3 no-print">
        <Select value={tipoF} onValueChange={setTipoF}>
          <SelectTrigger className="w-56" aria-label="Filtrar por tipo de unidade">
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
        <Button
          variant={apenasPendencias ? "default" : "outline"}
          aria-pressed={apenasPendencias}
          onClick={() => setApenasPendencias((v) => !v)}
        >
          {apenasPendencias ? "Mostrando só com pendência" : "Só unidades com pendência"}
        </Button>
      </div>

      <Legenda />

      <Card>
        <CardContent className="p-0">
          {linhas.length === 0 ? (
            <EmptyState
              icone={<Grid3x3 className="size-5" aria-hidden="true" />}
              titulo="Nenhuma unidade para estes filtros"
              descricao="Ajuste o tipo de unidade ou desligue o filtro de pendências."
            />
          ) : (
            <TableScroll>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card p-3 font-medium">Unidade</th>
                    {orgaosUsados.map((o) => (
                      <th key={o.value} className="p-3 text-center font-medium whitespace-nowrap">
                        <span title={o.descricao}>{o.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-card p-3 text-left font-normal"
                      >
                        <Link
                          to="/unidades/$id"
                          params={{ id: u.id }}
                          className="font-medium hover:underline"
                        >
                          {u.nome}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {tipoUnidadeLabel(u.tipo)}
                          {u.regiao_administrativa ? ` · ${u.regiao_administrativa}` : ""}
                        </div>
                      </th>
                      {orgaosUsados.map((o) => (
                        <CelulaMatriz
                          key={o.value}
                          unidadeId={u.id}
                          orgao={o.value}
                          celula={grade.get(u.id)?.get(o.value)}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CelulaMatriz({
  unidadeId,
  orgao,
  celula,
}: {
  unidadeId: string;
  orgao: string;
  celula?: Celula;
}) {
  if (!celula?.pior) {
    return (
      <td className="p-2 text-center align-middle">
        <span
          className="inline-block rounded border border-dashed px-2 py-1 text-xs text-muted-foreground"
          title="Nenhuma licença registada para este órgão nesta unidade"
        >
          —
        </span>
      </td>
    );
  }

  const tom = semaforoColor(celula.pior.semaforo ?? "");
  const venc = celula.pior.data_vencimento ? formatDate(celula.pior.data_vencimento) : null;

  return (
    <td className="p-2 text-center align-middle">
      <Link
        to="/licencas"
        search={{ unidade: unidadeId, orgao }}
        className={cn(
          "inline-flex min-w-24 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 transition-opacity hover:opacity-80",
          tom.bg,
          tom.text,
        )}
        title={`${statusLabel(celula.pior.status)}${venc ? ` · vence ${venc}` : ""} · ${celula.licencas.length} licença(s)`}
      >
        <span className="text-[11px] font-medium">{tom.label}</span>
        {venc && <span className="text-[10px] opacity-80">{venc}</span>}
        {celula.licencas.length > 1 && (
          <span className="text-[10px] opacity-70">{celula.licencas.length} licenças</span>
        )}
      </Link>
    </td>
  );
}

function Legenda() {
  const estados = [
    "vencida",
    "a_vencer_critico",
    "a_vencer_alerta",
    "vigente",
    "dispensada",
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="text-muted-foreground">Legenda:</span>
      {estados.map((e) => {
        const tom = semaforoColor(e);
        return (
          <span
            key={e}
            className={cn("inline-flex items-center gap-1.5 rounded px-2 py-1", tom.bg, tom.text)}
          >
            <span className={cn("size-1.5 rounded-full", tom.dot)} aria-hidden="true" />
            {tom.label}
          </span>
        );
      })}
      <span className="inline-flex items-center gap-1.5 rounded border border-dashed px-2 py-1 text-muted-foreground">
        — sem licença registada
      </span>
    </div>
  );
}
