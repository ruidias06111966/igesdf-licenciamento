import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listDashboard } from "@/lib/licencas.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, semaforoColor, ORGAOS } from "@/lib/domain";
import { AlertTriangle, Clock, CheckCircle2, FileWarning } from "lucide-react";

const opts = queryOptions({ queryKey: ["dashboard"], queryFn: () => listDashboard() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem dados.</div>,
});

function Dashboard() {
  const { data } = useSuspenseQuery(opts);
  const total = data.length;
  const vencidas = data.filter((d: any) => d.semaforo === "vencida").length;
  const criticas = data.filter((d: any) => d.semaforo === "a_vencer_critico").length;
  const alerta = data.filter((d: any) => d.semaforo === "a_vencer_alerta").length;
  const vigentes = data.filter((d: any) => d.semaforo === "vigente").length;
  const proximos = [...data]
    .filter((d: any) => d.data_vencimento && !["dispensada","indeferida"].includes(d.status))
    .sort((a: any,b: any) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""))
    .slice(0, 12);

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Painel de Compliance</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada do licenciamento em {new Set(data.map((d: any)=>d.unidade_id)).size} unidades — {total} licenças acompanhadas.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Vigentes" value={vigentes} tone="success" icon={<CheckCircle2 className="size-5" />} />
        <KPI label="A vencer ≤90d" value={alerta} tone="warning" icon={<Clock className="size-5" />} />
        <KPI label="Crítico ≤60d" value={criticas} tone="destructive" icon={<AlertTriangle className="size-5" />} />
        <KPI label="Vencidas" value={vencidas} tone="destructive" icon={<FileWarning className="size-5" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Próximos vencimentos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr><th className="p-3">Unidade</th><th className="p-3">Órgão</th><th className="p-3">Vencimento</th><th className="p-3">Dias</th><th className="p-3">Estado</th></tr>
            </thead>
            <tbody>
              {proximos.map((d: any) => {
                const s = semaforoColor(d.semaforo);
                const orgao = ORGAOS.find(o => o.value === d.orgao);
                return (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3"><Link to="/unidades/$id" params={{id: d.unidade_id}} className="font-medium hover:underline">{d.unidade_nome}</Link></td>
                    <td className="p-3">{orgao?.label ?? d.orgao}</td>
                    <td className="p-3">{formatDate(d.data_vencimento)}</td>
                    <td className="p-3">{d.dias_restantes ?? "—"}</td>
                    <td className="p-3"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                  </tr>
                );
              })}
              {proximos.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem vencimentos registados.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, tone, icon }: { label: string; value: number; tone: "success"|"warning"|"destructive"|"info"; icon: React.ReactNode }) {
  const map = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
  } as const;
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-3xl font-semibold mt-1">{value}</div>
        </div>
        <div className={`size-10 rounded-lg grid place-items-center ${map[tone]}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
