import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton, EmptyState, ErrorState } from "@/components/states";
import { SemaforoBadge } from "@/components/status-badge";
import { SortableTh, TableScroll } from "@/components/data-table";
import { useOrdenacao } from "@/lib/use-ordenacao";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { licencasQuery, proximosPassosQuery } from "@/lib/queries";
import {
  GRUPO_RISCO_INFO,
  ORGAOS,
  checklistStatusLabel,
  grupoRisco,
  orgaoLabel,
  parseCnae,
  semaforoColor,
  type GrupoRisco,
} from "@/lib/domain";
import { formatDate, formatDaysLeft } from "@/lib/dates";
import type { LicencaDashboard, ProximoPasso } from "@/lib/rows";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(licencasQuery),
      context.queryClient.ensureQueryData(proximosPassosQuery),
    ]),
  component: Dashboard,
  pendingComponent: () => <PageSkeleton cartoes={4} colunas={6} />,
  head: () => ({
    meta: [
      { title: "Painel — IGESDF Compliance" },
      {
        name: "description",
        content:
          "Painel consolidado de compliance da rede IGESDF: KPIs de licenças vigentes, vencidas, críticas e próximos passos por órgão.",
      },
      { property: "og:title", content: "Painel de Compliance — IGESDF" },
      {
        property: "og:description",
        content:
          "Visão consolidada de licenças, vencimentos e próximos passos da rede hospitalar do IGESDF.",
      },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/dashboard" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/dashboard" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

type ColunaVenc = "unidade" | "orgao" | "cnae" | "vencimento" | "situacao";

function Dashboard() {
  const { data } = useSuspenseQuery(licencasQuery);
  const { data: passos } = useSuspenseQuery(proximosPassosQuery);
  const [orgao, setOrgao] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const temFiltro = orgao !== "todos" || de !== "" || ate !== "";

  const filtrado = useMemo(
    () =>
      data.filter((d) => {
        if (orgao !== "todos" && d.orgao !== orgao) return false;
        if (de && (!d.data_vencimento || d.data_vencimento < de)) return false;
        if (ate && (!d.data_vencimento || d.data_vencimento > ate)) return false;
        return true;
      }),
    [data, orgao, de, ate],
  );

  const kpi = useMemo(() => {
    const conta = (s: string) => filtrado.filter((d) => d.semaforo === s).length;
    return {
      vigentes: conta("vigente"),
      alerta: conta("a_vencer_alerta"),
      criticas: conta("a_vencer_critico"),
      vencidas: conta("vencida"),
    };
  }, [filtrado]);

  /** Triagem da Fase 1: agrupa por gravidade em vez de só contar. */
  const triagem = useMemo(() => {
    const grupos: Record<GrupoRisco, LicencaDashboard[]> = { A: [], B: [], C: [] };
    for (const d of filtrado) {
      const g = grupoRisco(d);
      if (g) grupos[g].push(d);
    }
    return grupos;
  }, [filtrado]);

  /** Pendências por órgão: mostra onde concentrar esforço. */
  const porOrgao = useMemo(() => {
    const mapa = new Map<string, { total: number; pendentes: number }>();
    for (const d of filtrado) {
      const chave = d.orgao ?? "OUTRO";
      const atual = mapa.get(chave) ?? { total: 0, pendentes: 0 };
      atual.total += 1;
      if (grupoRisco(d)) atual.pendentes += 1;
      mapa.set(chave, atual);
    }
    return [...mapa.entries()]
      .map(([chave, v]) => ({ orgao: chave, ...v }))
      .sort((a, b) => b.pendentes - a.pendentes || b.total - a.total);
  }, [filtrado]);

  const maxOrgao = Math.max(1, ...porOrgao.map((o) => o.total));

  const proximos = useMemo(
    () =>
      filtrado.filter(
        (d) => d.data_vencimento && d.status !== "dispensada" && d.status !== "indeferida",
      ),
    [filtrado],
  );

  const { ordenados, ordem, alternar } = useOrdenacao<LicencaDashboard, ColunaVenc>(
    proximos,
    {
      unidade: (d) => d.unidade_nome,
      orgao: (d) => orgaoLabel(d.orgao),
      cnae: (d) => parseCnae(d.descricao).codigo,
      vencimento: (d) => d.data_vencimento,
      situacao: (d) => semaforoColor(d.semaforo ?? "").peso,
    },
    { chave: "vencimento", direcao: "asc" },
  );

  const listaVencimentos = ordenados.slice(0, 25);

  const passosFiltrados = useMemo(
    () =>
      (passos as ProximoPasso[])
        .filter((p) => orgao === "todos" || p.licencas?.orgao === orgao)
        .slice(0, 15),
    [passos, orgao],
  );

  function limpar() {
    setOrgao("todos");
    setDe("");
    setAte("");
  }

  return (
    <div className="print-area space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Painel de compliance"
        descricao={
          temFiltro
            ? `${filtrado.length} de ${data.length} licenças no filtro atual.`
            : `${data.length} licenças monitoradas na rede IGESDF.`
        }
        acoes={<PrintModeToggle defaultOrientation="landscape" />}
      />

      <div className="print-only mb-4">
        <h2 className="text-xl font-semibold">Painel de compliance — IGESDF</h2>
        <p className="text-xs">
          {orgao !== "todos" && <span>Órgão: {orgaoLabel(orgao)} · </span>}
          {de && <span>Vence de: {formatDate(de)} · </span>}
          {ate && <span>até: {formatDate(ate)} · </span>}
          Emitido em {formatDate(new Date().toISOString())}
        </p>
      </div>

      <Card className="no-print">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="dash-orgao" className="text-xs text-muted-foreground">
              Órgão
            </Label>
            <Select value={orgao} onValueChange={setOrgao}>
              <SelectTrigger id="dash-orgao">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-de" className="text-xs text-muted-foreground">
              Vence a partir de
            </Label>
            <Input id="dash-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-ate" className="text-xs text-muted-foreground">
              Vence até
            </Label>
            <Input id="dash-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={limpar} disabled={!temFiltro}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPI
          label="Vigentes"
          semaforo="vigente"
          value={kpi.vigentes}
          tone="success"
          icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
        />
        <KPI
          label="A vencer (≤90 dias)"
          semaforo="a_vencer_alerta"
          value={kpi.alerta}
          tone="warning"
          icon={<Clock className="size-5" aria-hidden="true" />}
        />
        <KPI
          label="Crítico (≤60 dias)"
          semaforo="a_vencer_critico"
          value={kpi.criticas}
          tone="destructive"
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          nota="Prazo mínimo para protocolar a renovação sanitária."
        />
        <KPI
          label="Vencidas"
          semaforo="vencida"
          value={kpi.vencidas}
          tone="destructive"
          icon={<FileWarning className="size-5" aria-hidden="true" />}
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {(["A", "B", "C"] as GrupoRisco[]).map((g) => (
          <CartaoTriagem key={g} grupo={g} itens={triagem[g]} />
        ))}
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" aria-hidden="true" /> Pendências por órgão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {porOrgao.map((o) => (
            <Link
              key={o.orgao}
              to="/licencas"
              search={{ orgao: o.orgao }}
              className="block space-y-1 rounded-md p-1.5 transition-colors hover:bg-muted/60"
            >
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium">{orgaoLabel(o.orgao)}</span>
                <span className="text-muted-foreground">
                  {o.pendentes} pendente(s) de {o.total}
                </span>
              </div>
              <div
                className="flex h-2 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${orgaoLabel(o.orgao)}: ${o.pendentes} pendentes de ${o.total} licenças`}
              >
                <div
                  className="bg-destructive/70"
                  style={{ width: `${(o.pendentes / maxOrgao) * 100}%` }}
                />
                <div
                  className="bg-success/60"
                  style={{ width: `${((o.total - o.pendentes) / maxOrgao) * 100}%` }}
                />
              </div>
            </Link>
          ))}
          {porOrgao.length === 0 && (
            <EmptyState compacto titulo="Sem licenças para os filtros escolhidos" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Próximos vencimentos
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {listaVencimentos.length} de {proximos.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <SortableTh chave="unidade" ordem={ordem} alternar={alternar}>
                    Unidade
                  </SortableTh>
                  <SortableTh chave="orgao" ordem={ordem} alternar={alternar}>
                    Órgão
                  </SortableTh>
                  <SortableTh chave="cnae" ordem={ordem} alternar={alternar}>
                    CNAE
                  </SortableTh>
                  <SortableTh chave="vencimento" ordem={ordem} alternar={alternar}>
                    Vencimento
                  </SortableTh>
                  <th className="p-3 font-medium">Prazo</th>
                  <SortableTh chave="situacao" ordem={ordem} alternar={alternar}>
                    Situação
                  </SortableTh>
                </tr>
              </thead>
              <tbody>
                {listaVencimentos.map((d) => {
                  const cnae = parseCnae(d.descricao);
                  return (
                    <tr key={d.id} className="print-row border-b last:border-0 hover:bg-muted/40">
                      <td className="p-3">
                        {d.unidade_id ? (
                          <Link
                            to="/unidades/$id"
                            params={{ id: d.unidade_id }}
                            className="font-medium hover:underline"
                          >
                            {d.unidade_nome}
                          </Link>
                        ) : (
                          <span className="font-medium">{d.unidade_nome}</span>
                        )}
                      </td>
                      <td className="p-3">{orgaoLabel(d.orgao)}</td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">
                        {cnae.codigo ?? "—"}
                      </td>
                      <td className="p-3 whitespace-nowrap">{formatDate(d.data_vencimento)}</td>
                      <td
                        className={cn(
                          "p-3 text-xs whitespace-nowrap",
                          (d.dias_restantes ?? 0) < 0 && "font-medium text-destructive",
                        )}
                      >
                        {formatDaysLeft(d.dias_restantes)}
                      </td>
                      <td className="p-3">
                        <SemaforoBadge semaforo={d.semaforo} />
                      </td>
                    </tr>
                  );
                })}
                {listaVencimentos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState
                        titulo="Nenhum vencimento nos filtros atuais"
                        descricao="Ajuste o intervalo de datas ou o órgão para ver mais registros."
                        acao={
                          temFiltro ? (
                            <Button size="sm" variant="outline" onClick={limpar}>
                              Limpar filtros
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4" aria-hidden="true" /> Próximos passos
            <span className="text-xs font-normal text-muted-foreground">
              {passosFiltrados.length} item(ns)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Unidade</th>
                  <th className="p-3 font-medium">Órgão</th>
                  <th className="p-3 font-medium">Etapa</th>
                  <th className="p-3 font-medium">Situação</th>
                  <th className="p-3 font-medium">Responsável</th>
                  <th className="p-3 font-medium">Prazo da licença</th>
                </tr>
              </thead>
              <tbody>
                {passosFiltrados.map((p) => (
                  <tr key={p.id} className="print-row border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      {p.licencas?.unidade_id ? (
                        <Link
                          to="/unidades/$id"
                          params={{ id: p.licencas.unidade_id }}
                          className="font-medium hover:underline"
                        >
                          {p.licencas.unidades?.nome ?? "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">{orgaoLabel(p.licencas?.orgao)}</td>
                    <td className="p-3 text-xs">{p.titulo}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{checklistStatusLabel(p.status)}</Badge>
                    </td>
                    <td className="p-3 text-xs">{p.responsavel ?? "—"}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {formatDate(p.licencas?.data_vencimento)}
                    </td>
                  </tr>
                ))}
                {passosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState
                        compacto
                        titulo="Nenhuma etapa pendente"
                        descricao="Os checklists são criados ao abrir uma licença na ficha da unidade."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </CardContent>
      </Card>
    </div>
  );
}

function CartaoTriagem({ grupo, itens }: { grupo: GrupoRisco; itens: LicencaDashboard[] }) {
  const info = GRUPO_RISCO_INFO[grupo];
  const tons: Record<GrupoRisco, string> = {
    A: "border-destructive/40",
    B: "border-warning/50",
    C: "border-info/40",
  };
  const unidades = new Set(itens.map((i) => i.unidade_id)).size;

  return (
    <Card className={cn("flex flex-col", tons[grupo])}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{info.titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">{info.descricao}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold">{itens.length}</span>
          <span className="text-xs text-muted-foreground">licença(s) em {unidades} unidade(s)</span>
        </div>
        <ul className="flex-1 space-y-1 text-xs">
          {itens.slice(0, 4).map((i) => (
            <li key={i.id} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">{i.unidade_nome}</span>
              <span className="shrink-0 text-muted-foreground">{orgaoLabel(i.orgao)}</span>
            </li>
          ))}
          {itens.length === 0 && <li className="text-muted-foreground">Nada neste grupo.</li>}
        </ul>
        {itens.length > 0 && (
          <Button asChild variant="ghost" size="sm" className="justify-start no-print">
            {/* Leva o grupo no URL: a listagem abre exatamente estas licenças. */}
            <Link to="/licencas" search={{ grupo }}>
              Ver as {itens.length} no detalhe
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function KPI({
  label,
  value,
  tone,
  icon,
  nota,
  semaforo,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "destructive" | "info";
  icon: ReactNode;
  nota?: string;
  semaforo: string;
}) {
  const tons = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
  } as const;
  return (
    <Card className="transition-colors hover:border-primary/50">
      <Link to="/licencas" search={{ semaforo }} className="block">
        <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold sm:text-3xl">{value}</div>
            {nota && <p className="mt-1 text-[11px] text-muted-foreground">{nota}</p>}
          </div>
          <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tons[tone])}>
            {icon}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
