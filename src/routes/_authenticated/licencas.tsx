import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listDashboard } from "@/lib/licencas.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORGAOS, semaforoColor, formatDate } from "@/lib/domain";
import { useState } from "react";

const opts = queryOptions({ queryKey: ["licencas-all"], queryFn: () => listDashboard() });

export const Route = createFileRoute("/_authenticated/licencas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: LicencasPage,
  head: () => ({ meta: [{ title: "Licenças — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem licenças.</div>,
});

function LicencasPage() {
  const { data } = useSuspenseQuery(opts);
  const [orgao, setOrgao] = useState<string>("todos");
  const [sem, setSem] = useState<string>("todos");
  const [q, setQ] = useState("");
  const filtered = data.filter((d: any) => {
    if (orgao !== "todos" && d.orgao !== orgao) return false;
    if (sem !== "todos" && d.semaforo !== sem) return false;
    if (q && !(d.unidade_nome + " " + (d.observacoes ?? "")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 space-y-4">
      <header><h1 className="text-2xl font-semibold">Todas as licenças</h1><p className="text-sm text-muted-foreground">{filtered.length} de {data.length} registos.</p></header>
      <div className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Procurar…" value={q} onChange={(e)=>setQ(e.target.value)} />
        <Select value={orgao} onValueChange={setOrgao}>
          <SelectTrigger><SelectValue placeholder="Órgão" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os órgãos</SelectItem>{ORGAOS.map(o=> <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sem} onValueChange={setSem}>
          <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="vencida">Vencidas</SelectItem>
            <SelectItem value="a_vencer_critico">Crítico ≤60d</SelectItem>
            <SelectItem value="a_vencer_alerta">A vencer ≤90d</SelectItem>
            <SelectItem value="vigente">Vigentes</SelectItem>
            <SelectItem value="dispensada">Dispensadas</SelectItem>
            <SelectItem value="indeferida">Indeferidas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b">
            <tr><th className="p-3">Unidade</th><th className="p-3">Órgão</th><th className="p-3">Estado</th><th className="p-3">Vencimento</th><th className="p-3">Dias</th><th className="p-3">Observação</th></tr>
          </thead>
          <tbody>
            {filtered.map((d: any) => {
              const s = semaforoColor(d.semaforo);
              const org = ORGAOS.find(o => o.value === d.orgao);
              return (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3"><Link to="/unidades/$id" params={{id: d.unidade_id}} className="font-medium hover:underline">{d.unidade_nome}</Link></td>
                  <td className="p-3">{org?.label ?? d.orgao}</td>
                  <td className="p-3"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                  <td className="p-3">{formatDate(d.data_vencimento)}</td>
                  <td className="p-3">{d.dias_restantes ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground max-w-md truncate">{d.observacoes ?? "—"}</td>
                </tr>
              );
            })}
            {filtered.length===0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem resultados.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
