import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDashboard, listUnidades, registrarDocumento } from "@/lib/licencas.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORGAOS, STATUS_LABEL, semaforoColor, formatDate, parseCnae } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { Printer, Upload, FileCheck2 } from "lucide-react";
import { useState, useMemo, Fragment } from "react";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["licencas-all"], queryFn: () => listDashboard() });
const unidadesOpts = queryOptions({ queryKey: ["unidades"], queryFn: () => listUnidades() });

export const Route = createFileRoute("/_authenticated/relatorios")({
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(opts), context.queryClient.ensureQueryData(unidadesOpts)]),
  component: RelatoriosPage,
  head: () => ({ meta: [{ title: "Relatórios — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem dados.</div>,
});

type Modo = "unidade" | "orgao";

function RelatoriosPage() {
  const { data } = useSuspenseQuery(opts);
  const { data: unidades } = useSuspenseQuery(unidadesOpts);
  const [modo, setModo] = useState<Modo>("unidade");
  const [unidadeF, setUnidadeF] = useState<string>("todos");
  const [orgaoF, setOrgaoF] = useState<string>("todos");
  const [apenasPend, setApenasPend] = useState(false);

  const filtrados = useMemo(() => data.filter((d: any) => {
    if (unidadeF !== "todos" && d.unidade_id !== unidadeF) return false;
    if (orgaoF !== "todos" && d.orgao !== orgaoF) return false;
    if (apenasPend && ["vigente","dispensada"].includes(d.status)) return false;
    return true;
  }), [data, unidadeF, orgaoF, apenasPend]);

  const grupos = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const it of filtrados) {
      const k: string = (modo === "unidade" ? it.unidade_nome : (ORGAOS.find(o=>o.value===it.orgao)?.label ?? it.orgao)) ?? "—";
      (g[k] ??= []).push(it);
    }
    return Object.entries(g).sort(([a],[b])=>a.localeCompare(b));
  }, [filtrados, modo]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filtrados.length;
    const vencidas = filtrados.filter((d:any)=>d.semaforo==="vencida").length;
    const criticas = filtrados.filter((d:any)=>d.semaforo==="a_vencer_critico").length;
    const alerta = filtrados.filter((d:any)=>d.semaforo==="a_vencer_alerta").length;
    const pendentes = filtrados.filter((d:any)=>["nao_iniciado","pendente_declaracao","em_estudo","em_analise","aguardando_orgao"].includes(d.status)).length;
    const vigentes = filtrados.filter((d:any)=>d.status==="vigente").length;
    return { total, vencidas, criticas, alerta, pendentes, vigentes };
  }, [filtrados]);

  return (
    <div className="p-8 space-y-6 print-area">
      <header className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios de conformidade</h1>
          <p className="text-sm text-muted-foreground">Relatório de licenciamentos por unidade ou por órgão, com pendências e prazos de renovação.</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-1" /> Imprimir PDF</Button>
      </header>

      <div className="grid md:grid-cols-4 gap-3 no-print">
        <Select value={modo} onValueChange={(v)=>setModo(v as Modo)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unidade">Agrupar por unidade</SelectItem>
            <SelectItem value="orgao">Agrupar por órgão</SelectItem>
          </SelectContent>
        </Select>
        <Select value={unidadeF} onValueChange={setUnidadeF}>
          <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todas as unidades</SelectItem>{unidades.map((u:any)=><SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={orgaoF} onValueChange={setOrgaoF}>
          <SelectTrigger><SelectValue placeholder="Órgão" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os órgãos</SelectItem>{ORGAOS.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant={apenasPend ? "default" : "outline"} onClick={()=>setApenasPend(v=>!v)}>
          {apenasPend ? "A mostrar apenas pendências" : "Mostrar apenas pendências"}
        </Button>
      </div>

      <div className="print-only mb-4">
        <h1 className="text-xl font-semibold">Relatório de conformidade — IGESDF</h1>
        <p className="text-xs">
          Agrupado por {modo === "unidade" ? "unidade" : "órgão"}
          {unidadeF !== "todos" && <> · Unidade: {unidades.find((u:any)=>u.id===unidadeF)?.nome}</>}
          {orgaoF !== "todos" && <> · Órgão: {ORGAOS.find(o=>o.value===orgaoF)?.label}</>}
          {apenasPend && <> · Apenas pendências</>}
          {" "}· Emitido {new Date().toLocaleDateString("pt-PT")}
        </p>
        <p className="text-xs mt-1">
          Total: {kpis.total} · Vigentes: {kpis.vigentes} · Pendentes: {kpis.pendentes} · A vencer ≤90d: {kpis.alerta} · Crítico ≤60d: {kpis.criticas} · Vencidas: {kpis.vencidas}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 no-print">
        {[
          { k: "Total", v: kpis.total, cls: "bg-muted" },
          { k: "Vigentes", v: kpis.vigentes, cls: "bg-success/15 text-success" },
          { k: "Pendentes", v: kpis.pendentes, cls: "bg-info/15 text-info" },
          { k: "A vencer", v: kpis.alerta, cls: "bg-warning/15" },
          { k: "Crítico", v: kpis.criticas, cls: "bg-destructive/15 text-destructive" },
          { k: "Vencidas", v: kpis.vencidas, cls: "bg-destructive/25 text-destructive" },
        ].map(x => (
          <Card key={x.k}><CardContent className={`p-3 ${x.cls} rounded-md`}>
            <div className="text-xs">{x.k}</div>
            <div className="text-2xl font-semibold">{x.v}</div>
          </CardContent></Card>
        ))}
      </div>

      {grupos.map(([nome, items]) => (
        <Card key={nome}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{nome} <span className="text-xs text-muted-foreground font-normal">· {items.length} registo(s)</span></CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="p-2">{modo === "unidade" ? "Órgão" : "Unidade"}</th>
                  <th className="p-2">CNAE</th>
                  <th className="p-2">Atividade</th>
                  <th className="p-2">Estado (semáforo)</th>
                  <th className="p-2">Situação</th>
                  <th className="p-2">Nº / SEI</th>
                  <th className="p-2">Vencimento</th>
                  <th className="p-2">Dias</th>
                </tr>
              </thead>
              <tbody>
                {items.sort((a:any,b:any)=>(a.data_vencimento??"9").localeCompare(b.data_vencimento??"9")).map((d:any) => {
                  const s = semaforoColor(d.semaforo);
                  const org = ORGAOS.find(o => o.value === d.orgao);
                  const cn = parseCnae(d.descricao);
                  return (
                    <Fragment key={d.id}>
                    <tr className="border-b last:border-0">
                      <td className="p-2">{modo === "unidade" ? (org?.label ?? d.orgao) : d.unidade_nome}</td>
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{cn.codigo ?? "—"}</td>
                      <td className="p-2 text-xs">{cn.label ?? "—"}</td>
                      <td className="p-2"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                      <td className="p-2 text-xs">{STATUS_LABEL[d.status as keyof typeof STATUS_LABEL] ?? d.status}</td>
                      <td className="p-2 text-xs">{[d.numero, d.processo_sei].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="p-2">{formatDate(d.data_vencimento)}</td>
                      <td className="p-2">{d.dias_restantes ?? "—"}</td>
                    </tr>
                    {d.observacoes && (
                      <tr className="border-b last:border-0">
                        <td colSpan={8} className="px-2 pb-2 text-xs italic text-muted-foreground">Obs.: {d.observacoes}</td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
      {grupos.length===0 && <p className="text-muted-foreground text-sm">Sem registos para os filtros escolhidos.</p>}

      <UploadCertificados unidades={unidades} />
    </div>
  );
}

function UploadCertificados({ unidades }: { unidades: any[] }) {
  const qc = useQueryClient();
  const [unidadeId, setUnidadeId] = useState<string>(unidades[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");
  const [busy, setBusy] = useState(false);
  const reg = useMutation({
    mutationFn: (payload: any) => registrarDocumento({ data: payload }),
  });

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !unidadeId) return;
    setBusy(true);
    try {
      const path = `certificados/${unidadeId}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await supabase.storage.from("licencas-docs").upload(path, file);
      if (up.error) throw up.error;
      await reg.mutateAsync({
        unidade_id: unidadeId, categoria: "certificado",
        nome: file.name, storage_path: path,
        mime_type: file.type || null, tamanho_bytes: file.size,
        descricao: descricao || null,
      });
      toast.success("Certificado enviado");
      setFile(null); setDescricao("");
      qc.invalidateQueries({ queryKey: ["unidade"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar");
    } finally { setBusy(false); }
  }

  return (
    <Card className="no-print">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="size-4" /> Validar cadastro — upload de certificados</CardTitle>
        <p className="text-xs text-muted-foreground">Envie o certificado REDESIM (ou equivalente) da unidade. Fica arquivado com trilha de auditoria para validar o cadastro em caso de alteração.</p>
      </CardHeader>
      <CardContent>
        <form className="grid md:grid-cols-4 gap-3 items-end" onSubmit={submeter}>
          <div className="space-y-1 md:col-span-1">
            <Label className="text-xs">Unidade</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger><SelectValue placeholder="Escolher unidade" /></SelectTrigger>
              <SelectContent>{unidades.map((u:any)=><SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-1">
            <Label className="text-xs">Ficheiro (PDF, imagem)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1 md:col-span-1">
            <Label className="text-xs">Descrição / referência</Label>
            <Input placeholder="Ex.: Certificado REDESIM 07/2026" value={descricao} onChange={(e)=>setDescricao(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy || !file || !unidadeId}>
            <Upload className="size-4 mr-1" /> {busy ? "A enviar…" : "Enviar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}