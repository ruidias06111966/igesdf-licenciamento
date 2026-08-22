import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/sub-nav";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { BotaoExportar } from "@/components/botao-exportar";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { TableScroll } from "@/components/data-table";
import { SemaforoBadge } from "@/components/status-badge";
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
import { licencasQuery } from "@/lib/queries";
import { formatDate, formatDaysLeft } from "@/lib/dates";
import { ORGAOS, orgaoLabel, parseCnae, semaforoColor, statusLabel } from "@/lib/domain";
import { sufixoData, type ColunaCsv } from "@/lib/csv";
import type { LicencaDashboard } from "@/lib/rows";

export const Route = createFileRoute("/_authenticated/relatorio-mensal")({
  loader: ({ context }) => context.queryClient.ensureQueryData(licencasQuery),
  component: RelatorioMensal,
  pendingComponent: () => <PageSkeleton cartoes={4} colunas={6} />,
  head: () => ({
    meta: [
      { title: "Relatório mensal por órgão — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Consolidado mensal por órgão (VISADF, CBMDF, IBRAM, CNES): contagem de licenças, prazos, vencidas e a vencer, pronto para PDF e Excel.",
      },
      { property: "og:title", content: "Relatório mensal por órgão — IGESDF" },
      {
        property: "og:description",
        content: "Contagem, prazos e listas de licenças vencidas e a vencer, por órgão e por mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Resumo = {
  orgao: string;
  total: number;
  vigentes: number;
  aVencerMes: number;
  vencidas: number;
  aVencer30: number;
  aVencer60: number;
  aVencer90: number;
  proximoPrazo: string | null;
};

function RelatorioMensal() {
  const { data } = useSuspenseQuery(licencasQuery);
  const [mes, setMes] = useState(mesAtual());
  const [orgaoF, setOrgaoF] = useState("todos");

  const base = useMemo(
    () => data.filter((l) => (orgaoF === "todos" ? true : l.orgao === orgaoF)),
    [data, orgaoF],
  );

  /** Licenças cujo vencimento cai na competência escolhida. */
  const doMes = useMemo(
    () => base.filter((l) => (l.data_vencimento ?? "").startsWith(mes)),
    [base, mes],
  );

  /** Vencidas + a vencer nos próximos 90 dias, o que exige ação imediata. */
  const criticas = useMemo(
    () =>
      base
        .filter(
          (l) =>
            l.dias_restantes !== null &&
            l.dias_restantes <= 90 &&
            l.status !== "dispensada" &&
            l.status !== "indeferida",
        )
        .sort((a, b) => (a.dias_restantes ?? 0) - (b.dias_restantes ?? 0)),
    [base],
  );

  const resumo = useMemo<Resumo[]>(() => {
    const mapa = new Map<string, Resumo>();
    for (const l of base) {
      const chave = orgaoLabel(l.orgao);
      const r =
        mapa.get(chave) ??
        ({
          orgao: chave,
          total: 0,
          vigentes: 0,
          aVencerMes: 0,
          vencidas: 0,
          aVencer30: 0,
          aVencer60: 0,
          aVencer90: 0,
          proximoPrazo: null,
        } satisfies Resumo);
      r.total += 1;
      if (l.status === "vigente") r.vigentes += 1;
      if (l.status === "vencida" || (l.dias_restantes ?? 1) < 0) r.vencidas += 1;
      if ((l.data_vencimento ?? "").startsWith(mes)) r.aVencerMes += 1;
      const d = l.dias_restantes;
      if (d !== null && d >= 0) {
        if (d <= 30) r.aVencer30 += 1;
        else if (d <= 60) r.aVencer60 += 1;
        else if (d <= 90) r.aVencer90 += 1;
        if (l.data_vencimento && (!r.proximoPrazo || l.data_vencimento < r.proximoPrazo)) {
          r.proximoPrazo = l.data_vencimento;
        }
      }
      mapa.set(chave, r);
    }
    return [...mapa.values()].sort((a, b) => b.vencidas - a.vencidas || b.total - a.total);
  }, [base, mes]);

  const totais = useMemo(
    () =>
      resumo.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          vencidas: acc.vencidas + r.vencidas,
          aVencer30: acc.aVencer30 + r.aVencer30,
          aVencerMes: acc.aVencerMes + r.aVencerMes,
        }),
        { total: 0, vencidas: 0, aVencer30: 0, aVencerMes: 0 },
      ),
    [resumo],
  );

  const colunasResumo: ColunaCsv<Resumo>[] = [
    { cabecalho: "Órgão", valor: (r) => r.orgao, largura: 28 },
    { cabecalho: "Total de licenças", valor: (r) => r.total },
    { cabecalho: "Vigentes", valor: (r) => r.vigentes },
    { cabecalho: "Vencidas", valor: (r) => r.vencidas },
    { cabecalho: "Vencem na competência", valor: (r) => r.aVencerMes },
    { cabecalho: "A vencer ≤30 dias", valor: (r) => r.aVencer30 },
    { cabecalho: "A vencer 31–60 dias", valor: (r) => r.aVencer60 },
    { cabecalho: "A vencer 61–90 dias", valor: (r) => r.aVencer90 },
    { cabecalho: "Próximo prazo", valor: (r) => formatDate(r.proximoPrazo) },
  ];

  const colunasDetalhe: ColunaCsv<LicencaDashboard>[] = [
    { cabecalho: "Órgão", valor: (l) => orgaoLabel(l.orgao) },
    { cabecalho: "Unidade", valor: (l) => l.unidade_nome, largura: 30 },
    { cabecalho: "CNAE", valor: (l) => parseCnae(l.descricao).codigo },
    { cabecalho: "Atividade", valor: (l) => parseCnae(l.descricao).label, largura: 40 },
    { cabecalho: "Situação", valor: (l) => statusLabel(l.status), situacao: true },
    { cabecalho: "Semáforo", valor: (l) => semaforoColor(l.semaforo ?? "").label, situacao: true },
    { cabecalho: "Número", valor: (l) => l.numero },
    { cabecalho: "Processo SEI", valor: (l) => l.processo_sei },
    { cabecalho: "Vencimento", valor: (l) => formatDate(l.data_vencimento) },
    { cabecalho: "Dias restantes", valor: (l) => l.dias_restantes },
  ];

  const rotuloMes = new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        titulo="Relatório mensal por órgão"
        descricao={`Contagem, prazos e listas de licenças vencidas e a vencer — competência ${rotuloMes}.`}
        migalhas={[
          { label: "Início", to: "/dashboard" },
          { label: "Relatórios", to: "/relatorios" },
          { label: "Mensal por órgão" },
        ]}
        acoes={
          <>
            <BotaoExportar
              nomeArquivo={`consolidado-mensal-${mes}-${sufixoData()}`}
              titulo="IGESDF — Consolidado mensal por órgão"
              subtitulo={`Competência ${rotuloMes}`}
              folha="Resumo por órgão"
              modulo="ConsolidadoMensal"
              meta={{ competencia: mes }}
              linhas={resumo}
              colunas={colunasResumo}
              rotulo="Exportar resumo"
            />
            <BotaoExportar
              nomeArquivo={`licencas-criticas-${mes}-${sufixoData()}`}
              titulo="IGESDF — Licenças vencidas e a vencer"
              subtitulo={`${criticas.length} licença(s) em janela de 90 dias`}
              folha="Vencidas e a vencer"
              modulo="LicencasCriticas"
              meta={{ competencia: mes }}
              linhas={criticas}
              colunas={colunasDetalhe}
              rotulo="Exportar lista"
              variant="secondary"
            />
            <PrintModeToggle />
          </>
        }
      />
      <SubNav grupo="relatorios" />

      <Card className="no-print">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="mes">Competência</Label>
            <Input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="orgao">Órgão</Label>
            <Select value={orgaoF} onValueChange={setOrgaoF}>
              <SelectTrigger id="orgao">
                <SelectValue />
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
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { rotulo: "Licenças no âmbito", valor: totais.total },
          { rotulo: "Vencidas", valor: totais.vencidas },
          { rotulo: "A vencer em 30 dias", valor: totais.aVencer30 },
          { rotulo: `Vencem em ${rotuloMes}`, valor: totais.aVencerMes },
        ].map((k) => (
          <Card key={k.rotulo}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.rotulo}</p>
              <p className="text-2xl font-semibold">{k.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo por órgão</CardTitle>
        </CardHeader>
        <CardContent>
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Órgão</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Vigentes</th>
                  <th className="p-2">Vencidas</th>
                  <th className="p-2">Na competência</th>
                  <th className="p-2">≤30 d</th>
                  <th className="p-2">31–60 d</th>
                  <th className="p-2">61–90 d</th>
                  <th className="p-2">Próximo prazo</th>
                </tr>
              </thead>
              <tbody>
                {resumo.map((r) => (
                  <tr key={r.orgao} className="border-t">
                    <td className="p-2 font-medium">{r.orgao}</td>
                    <td className="p-2">{r.total}</td>
                    <td className="p-2">{r.vigentes}</td>
                    <td className="p-2 font-semibold text-destructive">{r.vencidas}</td>
                    <td className="p-2">{r.aVencerMes}</td>
                    <td className="p-2">{r.aVencer30}</td>
                    <td className="p-2">{r.aVencer60}</td>
                    <td className="p-2">{r.aVencer90}</td>
                    <td className="p-2">{formatDate(r.proximoPrazo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Licenças vencidas e a vencer (janela de 90 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {criticas.length === 0 ? (
            <EmptyState
              compacto
              titulo="Nada em risco nesta janela"
              descricao="Nenhuma licença vencida ou a vencer nos próximos 90 dias para este filtro."
              icone={<CalendarRange className="size-5" aria-hidden="true" />}
            />
          ) : (
            <TableScroll>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Órgão</th>
                    <th className="p-2">Unidade</th>
                    <th className="p-2">Atividade / CNAE</th>
                    <th className="p-2">Situação</th>
                    <th className="p-2">Vencimento</th>
                    <th className="p-2">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {criticas.map((l) => (
                    <tr key={l.id} className="border-t align-top">
                      <td className="p-2">{orgaoLabel(l.orgao)}</td>
                      <td className="p-2 font-medium">{l.unidade_nome}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {parseCnae(l.descricao).codigo} · {parseCnae(l.descricao).label}
                      </td>
                      <td className="p-2">
                        <SemaforoBadge semaforo={l.semaforo} />
                      </td>
                      <td className="p-2">{formatDate(l.data_vencimento)}</td>
                      <td className="p-2">{formatDaysLeft(l.dias_restantes)}</td>
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
