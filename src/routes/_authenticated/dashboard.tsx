import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listDashboard, listProximosPassos } from "@/lib/licencas.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, semaforoColor, ORGAOS, STATUS_LABEL, CHECKLIST_STATUS_LABEL, parseCnae } from "@/lib/domain";
import { AlertTriangle, Clock, CheckCircle2, FileWarning, Printer, ListChecks } from "lucide-react";
import { useState, useMemo } from "react";

const opts = queryOptions({ queryKey: ["dashboard"], queryFn: () => listDashboard() });
const passosOpts = queryOptions({ queryKey: ["proximos-passos"], queryFn: () => listProximosPassos() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(opts),
    context.queryClient.ensureQueryData(passosOpts),
  ]),
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem dados.</div>,
});

function Dashboard() {
  const { data } = useSuspenseQuery(opts);
  const { data: passos } = useSuspenseQuery(passosOpts);
  const [orgao, setOrgao] = useState<string>("todos");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");

  const filtrado = useMemo(() => data.filter((d: any) => {
    if (orgao !== "todos" && d.orgao !== orgao) return false;
    if (de && (!d.data_vencimento || d.data_vencimento < de)) return false;
    if (ate && (!d.data_vencimento || d.data_vencimento > ate)) return false;
    return true;
  }), [data, orgao, de, ate]);

  const total = filtrado.length;
  const vencidas = filtrado.filter((d: any) => d.semaforo === "vencida").length;
  const criticas = filtrado.filter((d: any) => d.semaforo === "a_vencer_critico").length;
  const alerta = filtrado.filter((d: any) => d.semaforo === "a_vencer_alerta").length;
  const vigentes = filtrado.filter((d: any) => d.semaforo === "vigente").length;

  const proximos = [...filtrado]
    .filter((d: any) => d.data_vencimento && !["dispensada","indeferida"].includes(d.status))
    .sort((a: any,b: any) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""))
    .slice(0, 20);

  const passosFiltrados = useMemo(() => (passos as any[]).filter((p: any) => {
    if (orgao !== "todos" && p.licencas?.orgao !== orgao) return false;
    return true;
  }).slice(0, 15), [passos, orgao]);

  return (
    <div className="p-8 space-y-6 print-area">
      <header className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-semibold">Painel de Compliance</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada — {total} de {data.length} licenças no filtro atual.</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-1" /> Imprimir PDF</Button>
      </header>

      <div className="print-only mb-4">
        <h1 className="text-xl font-semibold">Painel de Compliance — IGESDF</h1>
        <p className="text-xs">
          {orgao !== "todos" && <>Órgão: {ORGAOS.find(o=>o.value===orgao)?.label} · </>}
          {de && <>De: {formatDate(de)} · </>}
          {ate && <>Até: {formatDate(ate)} · </>}
          Emitido {new Date().toLocaleDateString("pt-PT")}
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-3 no-print">
        <Select value={orgao} onValueChange={setOrgao}>
          <SelectTrigger><SelectValue placeholder="Órgão" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os órgãos</SelectItem>{ORGAOS.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground shrink-0">Vence de</span><Input type="date" value={de} onChange={(e)=>setDe(e.target.value)} /></div>
        <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground shrink-0">até</span><Input type="date" value={ate} onChange={(e)=>setAte(e.target.value)} /></div>
        <Button variant="ghost" onClick={()=>{ setOrgao("todos"); setDe(""); setAte(""); }}>Limpar filtros</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Vigentes" value={vigentes} tone="success" icon={<CheckCircle2 className="size-5" />} />
        <KPI label="A vencer ≤90d" value={alerta} tone="warning" icon={<Clock className="size-5" />} />
        <KPI label="Crítico ≤60d" value={criticas} tone="destructive" icon={<AlertTriangle className="size-5" />} />
        <KPI label="Vencidas" value={vencidas} tone="destructive" icon={<FileWarning className="size-5" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Próximos vencimentos ({proximos.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="p-3">Unidade</th>
                <th className="p-3">Órgão</th>
                <th className="p-3">CNAE</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Dias</th>
                <th className="p-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {proximos.map((d: any) => {
                const s = semaforoColor(d.semaforo);
                const org = ORGAOS.find(o => o.value === d.orgao);
                const cn = parseCnae(d.descricao);
                return (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/40 print-row">
                    <td className="p-3"><Link to="/unidades/$id" params={{id: d.unidade_id}} className="font-medium hover:underline">{d.unidade_nome}</Link></td>
                    <td className="p-3">{org?.label ?? d.orgao}</td>
                    <td className="p-3 font-mono text-xs">{cn.codigo ?? "—"}</td>
                    <td className="p-3">{formatDate(d.data_vencimento)}</td>
                    <td className="p-3">{d.dias_restantes ?? "—"}</td>
                    <td className="p-3"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                  </tr>
                );
              })}
              {proximos.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem vencimentos para os filtros.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="size-4" /> Próximos passos ({passosFiltrados.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="p-3">Unidade</th>
                <th className="p-3">Órgão</th>
                <th className="p-3">Item</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Responsável</th>
                <th className="p-3">Prazo licença</th>
              </tr>
            </thead>
            <tbody>
              {passosFiltrados.map((p: any) => {
                const org = ORGAOS.find(o => o.value === p.licencas?.orgao);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40 print-row">
                    <td className="p-3"><Link to="/unidades/$id" params={{id: p.licencas?.unidade_id}} className="font-medium hover:underline">{p.licencas?.unidades?.nome ?? "—"}</Link></td>
                    <td className="p-3">{org?.label ?? p.licencas?.orgao}</td>
                    <td className="p-3 text-xs">{p.titulo}</td>
                    <td className="p-3"><Badge variant="secondary">{CHECKLIST_STATUS_LABEL[p.status] ?? p.status}</Badge></td>
                    <td className="p-3 text-xs">{p.responsavel ?? "—"}</td>
                    <td className="p-3 text-xs">{formatDate(p.licencas?.data_vencimento)}</td>
                  </tr>
                );
              })}
              {passosFiltrados.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem passos pendentes.</td></tr>}
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