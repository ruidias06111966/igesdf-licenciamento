import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listDashboard } from "@/lib/licencas.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORGAOS, semaforoColor, formatDate, parseCnae } from "@/lib/domain";

const opts = queryOptions({ queryKey: ["licencas-all"], queryFn: () => listDashboard() });

export const Route = createFileRoute("/_authenticated/calendario")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: Cal,
  head: () => ({ meta: [{ title: "Vencimentos — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem dados.</div>,
});

function groupByMonth(items: any[]) {
  const g: Record<string, any[]> = {};
  for (const it of items) {
    if (!it.data_vencimento) continue;
    const key = it.data_vencimento.slice(0, 7);
    (g[key] ??= []).push(it);
  }
  return Object.entries(g).sort(([a],[b])=>a.localeCompare(b));
}

function Cal() {
  const { data } = useSuspenseQuery(opts);
  const upcoming = data.filter((d: any) => d.data_vencimento && !["dispensada","indeferida"].includes(d.status));
  const groups = groupByMonth(upcoming);
  const monthName = (yyyymm: string) => {
    const [y,m] = yyyymm.split("-");
    return new Date(Number(y), Number(m)-1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  };

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Calendário de vencimentos</h1>
        <p className="text-sm text-muted-foreground">Renove a licença sanitária com pelo menos 60 dias de antecedência.</p>
      </header>
      {groups.map(([month, items]) => (
        <Card key={month}>
          <CardHeader><CardTitle className="capitalize">{monthName(month)}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {items.sort((a,b)=>a.data_vencimento.localeCompare(b.data_vencimento)).map(d => {
              const s = semaforoColor(d.semaforo);
              const org = ORGAOS.find(o => o.value === d.orgao);
              const cn = parseCnae(d.descricao);
              return (
                <Link key={d.id} to="/unidades/$id" params={{id: d.unidade_id}} className="flex items-center justify-between border rounded-md p-3 hover:bg-muted/30">
                  <div>
                    <div className="text-sm font-medium">{d.unidade_nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {org?.label ?? d.orgao}
                      {cn.codigo && <> • <span className="font-mono">CNAE {cn.codigo}</span></>}
                      {cn.label && <> — {cn.label}</>}
                    </div>
                    <div className="text-xs text-muted-foreground">Vence em {formatDate(d.data_vencimento)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{d.dias_restantes}d</span>
                    <Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      ))}
      {groups.length===0 && <p className="text-muted-foreground text-sm">Sem vencimentos futuros registados.</p>}
    </div>
  );
}
