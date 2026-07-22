import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDashboard, listUnidades, upsertLicenca, deleteLicenca } from "@/lib/licencas.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORGAOS, STATUS_LABEL, semaforoColor, formatDate, parseCnae } from "@/lib/domain";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { useState, Fragment } from "react";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["licencas-all"], queryFn: () => listDashboard() });
const unidadesOpts = queryOptions({ queryKey: ["unidades"], queryFn: () => listUnidades() });

export const Route = createFileRoute("/_authenticated/licencas")({
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(opts), context.queryClient.ensureQueryData(unidadesOpts)]),
  component: LicencasPage,
  head: () => ({ meta: [{ title: "Licenças — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem licenças.</div>,
});

function LicencasPage() {
  const { data } = useSuspenseQuery(opts);
  const { data: unidades } = useSuspenseQuery(unidadesOpts);
  const [orgao, setOrgao] = useState<string>("todos");
  const [sem, setSem] = useState<string>("todos");
  const [unidadeF, setUnidadeF] = useState<string>("todos");
  const [cnaeF, setCnaeF] = useState<string>("todos");
  const [q, setQ] = useState("");
  const cnaesUnicos = Array.from(new Set(data.map((d: any) => parseCnae(d.descricao).codigo).filter(Boolean))).sort() as string[];
  const filtered = data.filter((d: any) => {
    if (orgao !== "todos" && d.orgao !== orgao) return false;
    if (sem !== "todos" && d.semaforo !== sem) return false;
    if (unidadeF !== "todos" && d.unidade_id !== unidadeF) return false;
    if (cnaeF !== "todos" && parseCnae(d.descricao).codigo !== cnaeF) return false;
    if (q && !(d.unidade_nome + " " + (d.descricao ?? "") + " " + (d.observacoes ?? "")).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 space-y-4 print-area">
      <header className="flex items-center justify-between no-print">
        <div><h1 className="text-2xl font-semibold">Todas as licenças</h1><p className="text-sm text-muted-foreground">{filtered.length} de {data.length} registos.</p></div>
        <div className="flex gap-2">
          <PrintModeToggle defaultOrientation="landscape" />
          <LicencaFormGlobal unidades={unidades} trigger={<Button><Plus className="size-4 mr-1" /> Incluir licença</Button>} />
        </div>
      </header>
      <div className="print-only mb-4">
        <h1 className="text-xl font-semibold">Licenças — IGESDF</h1>
        <p className="text-xs">
          {unidadeF !== "todos" && <>Unidade: {unidades.find((u:any)=>u.id===unidadeF)?.nome} · </>}
          {orgao !== "todos" && <>Órgão: {ORGAOS.find(o=>o.value===orgao)?.label} · </>}
          {cnaeF !== "todos" && <>CNAE: {cnaeF} · </>}
          Total: {filtered.length} · Emitido {new Date().toLocaleDateString("pt-PT")}
        </p>
      </div>
      <div className="grid md:grid-cols-5 gap-3 no-print">
        <Input placeholder="Procurar…" value={q} onChange={(e)=>setQ(e.target.value)} />
        <Select value={unidadeF} onValueChange={setUnidadeF}>
          <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todas as unidades</SelectItem>{unidades.map((u:any)=><SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={orgao} onValueChange={setOrgao}>
          <SelectTrigger><SelectValue placeholder="Órgão" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os órgãos</SelectItem>{ORGAOS.map(o=> <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cnaeF} onValueChange={setCnaeF}>
          <SelectTrigger><SelectValue placeholder="CNAE" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os CNAEs</SelectItem>{cnaesUnicos.map(c=> <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
            <tr>
              <th className="p-3">Unidade</th>
              <th className="p-3">Órgão</th>
              <th className="p-3">CNAE</th>
              <th className="p-3">Atividade</th>
              <th className="p-3">Estado</th>
              <th className="p-3 print-only-cell">Situação</th>
              <th className="p-3 print-only-cell">Nº</th>
              <th className="p-3 print-only-cell">Processo SEI</th>
              <th className="p-3">Vencimento</th>
              <th className="p-3">Dias</th>
              <th className="p-3 text-right no-print">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d: any) => {
              const s = semaforoColor(d.semaforo);
              const org = ORGAOS.find(o => o.value === d.orgao);
              const cn = parseCnae(d.descricao);
              return (
                <Fragment key={d.id}>
                <tr className="border-b hover:bg-muted/30 print-row">
                  <td className="p-3"><Link to="/unidades/$id" params={{id: d.unidade_id}} className="font-medium hover:underline">{d.unidade_nome}</Link></td>
                  <td className="p-3">{org?.label ?? d.orgao}</td>
                  <td className="p-3 font-mono text-xs whitespace-nowrap">{cn.codigo ?? "—"}</td>
                  <td className="p-3 text-xs max-w-xs truncate" title={cn.label ?? ""}>{cn.label ?? "—"}</td>
                  <td className="p-3"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                  <td className="p-3 text-xs print-only-cell">{STATUS_LABEL[d.status as keyof typeof STATUS_LABEL] ?? d.status}</td>
                  <td className="p-3 text-xs print-only-cell">{d.numero ?? "—"}</td>
                  <td className="p-3 text-xs print-only-cell">{d.processo_sei ?? "—"}</td>
                  <td className="p-3">{formatDate(d.data_vencimento)}</td>
                  <td className="p-3">{d.dias_restantes ?? "—"}</td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap no-print">
                    <LicencaFormGlobal unidades={unidades} initial={d} trigger={<Button size="icon" variant="ghost" title="Alterar"><Pencil className="size-4" /></Button>} />
                    <DeleteLicBtn id={d.id} />
                  </td>
                </tr>
                {d.observacoes && (
                  <tr className="border-b last:border-0 print-only-row">
                    <td colSpan={11} className="px-3 pb-2 text-xs italic text-muted-foreground">Obs.: {d.observacoes}</td>
                  </tr>
                )}
                </Fragment>
              );
            })}
            {filtered.length===0 && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Sem resultados.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

function DeleteLicBtn({ id }: { id: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => deleteLicenca({ data: { id } }),
    onSuccess: () => { toast.success("Licença removida"); qc.invalidateQueries({ queryKey: ["licencas-all"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["unidade"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" title="Excluir"><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Excluir licença</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={del.isPending} onClick={()=>del.mutate()}>Excluir</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LicencaFormGlobal({ unidades, initial, trigger }: { unidades: any[]; initial?: any; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(initial ?? { unidade_id: unidades[0]?.id ?? "", orgao: "VISA", status: "nao_iniciado" });
  const m = useMutation({
    mutationFn: (data: any) => upsertLicenca({ data }),
    onSuccess: () => { toast.success("Licença guardada"); qc.invalidateQueries({ queryKey: ["licencas-all"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["unidade"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{initial ? "Alterar licença" : "Nova licença"}</SheetTitle></SheetHeader>
        <form className="space-y-3 mt-4 px-4 pb-4" onSubmit={(e)=>{e.preventDefault(); m.mutate(form);}}>
          <div className="space-y-1"><Label className="text-xs">Unidade</Label>
            <Select value={form.unidade_id} onValueChange={(v)=>setForm({...form, unidade_id: v})}>
              <SelectTrigger><SelectValue placeholder="Escolher unidade" /></SelectTrigger>
              <SelectContent>{unidades.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Órgão</Label>
              <Select value={form.orgao} onValueChange={(v)=>setForm({...form, orgao: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ORGAOS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Estado</Label>
              <Select value={form.status} onValueChange={(v)=>setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_LABEL).map(([k,v])=> <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">CNAE / Atividade licenciada</Label>
            <Input placeholder="Ex.: CNAE 8610-1/02 — Pronto-socorro" value={form.descricao ?? ""} onChange={(e)=>setForm({...form, descricao: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Data emissão</Label><Input type="date" value={form.data_emissao ?? ""} onChange={(e)=>setForm({...form, data_emissao: e.target.value || null})} /></div>
            <div className="space-y-1"><Label className="text-xs">Data vencimento</Label><Input type="date" value={form.data_vencimento ?? ""} onChange={(e)=>setForm({...form, data_vencimento: e.target.value || null})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Número</Label><Input value={form.numero ?? ""} onChange={(e)=>setForm({...form, numero: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs">Processo SEI</Label><Input value={form.processo_sei ?? ""} onChange={(e)=>setForm({...form, processo_sei: e.target.value})} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Observações</Label><Textarea rows={3} value={form.observacoes ?? ""} onChange={(e)=>setForm({...form, observacoes: e.target.value})} /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" type="button" onClick={()=>setOpen(false)}>Cancelar</Button><Button disabled={m.isPending || !form.unidade_id} type="submit">{m.isPending ? "A guardar…" : "Guardar"}</Button></div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
