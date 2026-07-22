import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listDashboard, listUnidades } from "@/lib/licencas.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { useState } from "react";
import { ORGAOS, STATUS_LABEL, semaforoColor, formatDate, parseCnae } from "@/lib/domain";

const opts = queryOptions({ queryKey: ["licencas-all"], queryFn: () => listDashboard() });
const unidadesOpts = queryOptions({ queryKey: ["unidades"], queryFn: () => listUnidades() });

export const Route = createFileRoute("/_authenticated/calendario")({
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(opts), context.queryClient.ensureQueryData(unidadesOpts)]),
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
  const { data: unidades } = useSuspenseQuery(unidadesOpts);
  const [unidadeF, setUnidadeF] = useState<string>("todos");
  const [orgaoF, setOrgaoF] = useState<string>("todos");
  const [cnaeF, setCnaeF] = useState<string>("todos");
  const cnaesUnicos = Array.from(new Set(data.map((d: any) => parseCnae(d.descricao).codigo).filter(Boolean))).sort() as string[];
  const upcoming = data.filter((d: any) => {
    if (!d.data_vencimento || ["dispensada","indeferida"].includes(d.status)) return false;
    if (unidadeF !== "todos" && d.unidade_id !== unidadeF) return false;
    if (orgaoF !== "todos" && d.orgao !== orgaoF) return false;
    if (cnaeF !== "todos" && parseCnae(d.descricao).codigo !== cnaeF) return false;
    return true;
  });
  const groups = groupByMonth(upcoming);
  const monthName = (yyyymm: string) => {
    const [y,m] = yyyymm.split("-");
    return new Date(Number(y), Number(m)-1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  };

  return (
    <div className="p-8 space-y-6 print-area">
      <header className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-semibold">Calendário de vencimentos</h1>
          <p className="text-sm text-muted-foreground">Renove a licença sanitária com pelo menos 60 dias de antecedência.</p>
        </div>
        <PrintModeToggle defaultOrientation="landscape" />
      </header>
      <div className="print-only mb-4">
        <h1 className="text-xl font-semibold">Calendário de vencimentos — IGESDF</h1>
        <p className="text-xs">
          {unidadeF !== "todos" && <>Unidade: {unidades.find((u:any)=>u.id===unidadeF)?.nome} · </>}
          {orgaoF !== "todos" && <>Órgão: {ORGAOS.find(o=>o.value===orgaoF)?.label} · </>}
          {cnaeF !== "todos" && <>CNAE: {cnaeF} · </>}
          Emitido {new Date().toLocaleDateString("pt-PT")}
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-3 no-print">
        <Select value={unidadeF} onValueChange={setUnidadeF}>
          <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todas as unidades</SelectItem>{unidades.map((u:any)=><SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={orgaoF} onValueChange={setOrgaoF}>
          <SelectTrigger><SelectValue placeholder="Órgão" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os órgãos</SelectItem>{ORGAOS.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cnaeF} onValueChange={setCnaeF}>
          <SelectTrigger><SelectValue placeholder="CNAE" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os CNAEs</SelectItem>{cnaesUnicos.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
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
                    <div className="text-xs text-muted-foreground print-only">
                      Estado: {STATUS_LABEL[d.status as keyof typeof STATUS_LABEL] ?? d.status}
                      {d.numero && <> · Nº {d.numero}</>}
                      {d.processo_sei && <> · SEI {d.processo_sei}</>}
                    </div>
                    {d.observacoes && <div className="text-xs italic text-muted-foreground print-only">Obs.: {d.observacoes}</div>}
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
