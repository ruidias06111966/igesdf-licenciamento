import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SemaforoBadge } from "@/components/status-badge";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { licencasQuery, unidadesQuery } from "@/lib/queries";
import { ORGAOS, orgaoLabel, parseCnae, statusLabel } from "@/lib/domain";
import { formatDate, formatDaysLeft, formatMonth, toIsoDate, today } from "@/lib/dates";
import type { LicencaDashboard } from "@/lib/rows";
import { SubNav } from "@/components/sub-nav";

export const Route = createFileRoute("/_authenticated/calendario")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(licencasQuery),
      context.queryClient.ensureQueryData(unidadesQuery),
    ]),
  component: Calendario,
  pendingComponent: () => <PageSkeleton linhas={8} colunas={3} />,
  head: () => ({
    meta: [
      { title: "Vencimentos — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Calendário de vencimentos de licenças e alvarás da rede IGESDF, com semáforo por prazo e filtros por órgão e unidade.",
      },
      { property: "og:title", content: "Calendário de vencimentos — IGESDF" },
      {
        property: "og:description",
        content: "Datas de vencimento e renovação de licenças da rede hospitalar do IGESDF.",
      },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/calendario" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/calendario" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

/** Agrupa por mês (AAAA-MM), com cada grupo ordenado por data. */
function agruparPorMes(itens: LicencaDashboard[]): [string, LicencaDashboard[]][] {
  const grupos = new Map<string, LicencaDashboard[]>();
  for (const it of itens) {
    if (!it.data_vencimento) continue;
    const chave = it.data_vencimento.slice(0, 7);
    const lista = grupos.get(chave);
    if (lista) lista.push(it);
    else grupos.set(chave, [it]);
  }
  return [...grupos.entries()]
    .map(
      ([mes, lista]) =>
        // Cópia antes de ordenar: o array pertence ao resultado memoizado.
        [
          mes,
          [...lista].sort((a, b) =>
            (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""),
          ),
        ] as [string, LicencaDashboard[]],
    )
    .sort(([a], [b]) => a.localeCompare(b));
}

function Calendario() {
  const { data } = useSuspenseQuery(licencasQuery);
  const { data: unidades } = useSuspenseQuery(unidadesQuery);
  const [unidadeF, setUnidadeF] = useState("todos");
  const [orgaoF, setOrgaoF] = useState("todos");
  const [cnaeF, setCnaeF] = useState("todos");

  const temFiltro = unidadeF !== "todos" || orgaoF !== "todos" || cnaeF !== "todos";

  const cnaesUnicos = useMemo(
    () =>
      [
        ...new Set(data.map((d) => parseCnae(d.descricao).codigo).filter(Boolean)),
      ].sort() as string[],
    [data],
  );

  const comPrazo = useMemo(
    () =>
      data.filter((d) => {
        if (!d.data_vencimento) return false;
        if (d.status === "dispensada" || d.status === "indeferida") return false;
        if (unidadeF !== "todos" && d.unidade_id !== unidadeF) return false;
        if (orgaoF !== "todos" && d.orgao !== orgaoF) return false;
        if (cnaeF !== "todos" && parseCnae(d.descricao).codigo !== cnaeF) return false;
        return true;
      }),
    [data, unidadeF, orgaoF, cnaeF],
  );

  // Vencidas e futuras eram misturadas na mesma lista, sob a mensagem "Sem
  // vencimentos futuros" — separá-las é o que torna a página utilizável para
  // triagem.
  const hoje = toIsoDate(today());
  const vencidas = useMemo(
    () =>
      [...comPrazo.filter((d) => (d.data_vencimento ?? "") < hoje)].sort((a, b) =>
        (b.data_vencimento ?? "").localeCompare(a.data_vencimento ?? ""),
      ),
    [comPrazo, hoje],
  );
  const futuras = useMemo(
    () => comPrazo.filter((d) => (d.data_vencimento ?? "") >= hoje),
    [comPrazo, hoje],
  );
  const meses = useMemo(() => agruparPorMes(futuras), [futuras]);

  function limpar() {
    setUnidadeF("todos");
    setOrgaoF("todos");
    setCnaeF("todos");
  }

  return (
    <div className="print-area space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Calendário de vencimentos"
        descricao={`${futuras.length} vencimento(s) futuro(s) e ${vencidas.length} em atraso.`}
        acoes={<PrintModeToggle defaultOrientation="landscape" />}
      />
      <SubNav grupo="painel" />

      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs no-print">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          A renovação da Licença Sanitária deve ser protocolada com{" "}
          <strong>até 60 dias de antecedência</strong> do vencimento, dispensando a reapresentação
          de documentos que não tenham mudado.
        </p>
      </div>

      <div className="print-only mb-4">
        <h1 className="text-xl font-semibold">Calendário de vencimentos — IGESDF</h1>
        <p className="text-xs">
          {unidadeF !== "todos" && (
            <span>Unidade: {unidades.find((u) => u.id === unidadeF)?.nome} · </span>
          )}
          {orgaoF !== "todos" && <span>Órgão: {orgaoLabel(orgaoF)} · </span>}
          {cnaeF !== "todos" && <span>CNAE: {cnaeF} · </span>}
          Emitido em {formatDate(new Date().toISOString())}
        </p>
      </div>

      <Card className="no-print">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-4">
          <Select value={unidadeF} onValueChange={setUnidadeF}>
            <SelectTrigger aria-label="Filtrar por unidade">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={orgaoF} onValueChange={setOrgaoF}>
            <SelectTrigger aria-label="Filtrar por órgão">
              <SelectValue placeholder="Órgão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os órgãos</SelectItem>
              {ORGAOS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cnaeF} onValueChange={setCnaeF}>
            <SelectTrigger aria-label="Filtrar por CNAE">
              <SelectValue placeholder="CNAE" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os CNAEs</SelectItem>
              {cnaesUnicos.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {temFiltro && (
            <Button variant="outline" onClick={limpar}>
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {vencidas.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="size-4" aria-hidden="true" /> Em atraso
              <span className="text-xs font-normal text-muted-foreground">
                {vencidas.length} licença(s)
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Prazo já vencido. Regularize antes de qualquer renovação programada.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {vencidas.map((d) => (
              <LinhaVencimento key={d.id} licenca={d} />
            ))}
          </CardContent>
        </Card>
      )}

      {meses.map(([mes, itens]) => (
        <Card key={mes}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base capitalize">
              {formatMonth(mes)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground normal-case">
                {itens.length} vencimento(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {itens.map((d) => (
              <LinhaVencimento key={d.id} licenca={d} />
            ))}
          </CardContent>
        </Card>
      ))}

      {meses.length === 0 && vencidas.length === 0 && (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icone={<CalendarClock className="size-5" aria-hidden="true" />}
              titulo="Nenhum vencimento registrado"
              descricao={
                temFiltro
                  ? "Nenhuma licença com data de vencimento corresponde aos filtros."
                  : "Preencha a data de vencimento das licenças para que apareçam no calendário."
              }
              acao={
                temFiltro ? (
                  <Button size="sm" variant="outline" onClick={limpar}>
                    Limpar filtros
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link to="/licencas">Ir para licenças</Link>
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinhaVencimento({ licenca }: { licenca: LicencaDashboard }) {
  const cnae = parseCnae(licenca.descricao);
  const conteudo = (
    <>
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium">{licenca.unidade_nome}</div>
        <div className="text-xs text-muted-foreground">
          {orgaoLabel(licenca.orgao)}
          {cnae.codigo && (
            <>
              {" • "}
              <span className="font-mono">CNAE {cnae.codigo}</span>
            </>
          )}
          {cnae.label && ` — ${cnae.label}`}
        </div>
        <div className="text-xs text-muted-foreground">
          Vence em {formatDate(licenca.data_vencimento)}
        </div>
        <div className="print-only text-xs text-muted-foreground">
          Situação: {statusLabel(licenca.status)}
          {licenca.numero && ` · Nº ${licenca.numero}`}
          {licenca.processo_sei && ` · SEI ${licenca.processo_sei}`}
        </div>
        {licenca.observacoes && (
          <div className="print-only text-xs italic text-muted-foreground">
            Obs.: {licenca.observacoes}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {formatDaysLeft(licenca.dias_restantes)}
        </span>
        <SemaforoBadge semaforo={licenca.semaforo} />
      </div>
    </>
  );

  if (!licenca.unidade_id) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        {conteudo}
      </div>
    );
  }

  return (
    <Link
      to="/unidades/$id"
      params={{ id: licenca.unidade_id }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-muted/30"
    >
      {conteudo}
    </Link>
  );
}
