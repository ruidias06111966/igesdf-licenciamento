import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUnidade, upsertLicenca, deleteLicenca, upsertRT, deleteRT, registrarDocumento, deleteDocumento, signedDocUrl, deleteUnidade, upsertCnae, deleteCnae, getChecklist, updateChecklistItem, registrarNovaVersao, listVersoesDocumento } from "@/lib/licencas.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ORGAOS, STATUS_LABEL, semaforoColor, formatDate, StatusLicenca, CHECKLIST_STATUS_LABEL, parseCnae } from "@/lib/domain";
import { ArrowLeft, Plus, Pencil, Trash2, Upload, Download, FileText, UserCog, ListChecks, History, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UnidadeForm } from "./unidades";

function unidadeOpts(id: string) {
  return queryOptions({ queryKey: ["unidade", id], queryFn: () => getUnidade({ data: { id } }) });
}

export const Route = createFileRoute("/_authenticated/unidades/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(unidadeOpts(params.id)),
  component: UnidadeDetalhe,
  head: ({ params }) => ({ meta: [{ title: `Unidade — IGESDF Compliance` }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Unidade não encontrada.</div>,
});

function UnidadeDetalhe() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(unidadeOpts(id));
  const { unidade, licencas, responsaveis, documentos, cnaes } = data as any;

  const delU = useMutation({
    mutationFn: () => deleteUnidade({ data: { id } }),
    onSuccess: () => { toast.success("Unidade removida"); qc.invalidateQueries({ queryKey: ["unidades"] }); nav({ to: "/unidades" }); },
    onError: (e: any) => toast.error(e.message),
  });

  function semaforoOf(l: any) {
    if (l.status === "dispensada" || l.status === "indeferida") return l.status;
    if (!l.data_vencimento) return l.status;
    const dv = new Date(l.data_vencimento);
    const now = new Date();
    const dias = Math.round((dv.getTime() - now.getTime()) / 86400000);
    if (dias < 0) return "vencida";
    if (dias <= 60) return "a_vencer_critico";
    if (dias <= 90) return "a_vencer_alerta";
    return "vigente";
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/unidades"><Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" /> Voltar</Button></Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground">Nº {unidade.numero_iges ?? "—"}</div>
          <h1 className="text-2xl font-semibold">{unidade.nome}</h1>
          <div className="text-sm text-muted-foreground mt-1 space-x-3">
            <span>CNPJ {unidade.cnpj ?? "—"}</span>
            <span>CF/DF {unidade.cf_df ?? "—"}</span>
            <span>SEI {unidade.processo_sei ?? "—"}</span>
          </div>
          {unidade.endereco && <div className="text-sm mt-2 max-w-2xl">{unidade.endereco}</div>}
        </div>
        <div className="flex gap-2">
          <UnidadeForm initial={unidade} trigger={<Button variant="outline"><Pencil className="size-4 mr-1" /> Alterar</Button>} />
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" className="text-destructive"><Trash2 className="size-4 mr-1" /> Excluir</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Remover unidade</AlertDialogTitle><AlertDialogDescription>A unidade será desativada. O histórico é preservado.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={delU.isPending} onClick={()=>delU.mutate()}>Excluir</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Licenças e Alvarás ({licencas.length})</CardTitle>
          <LicencaForm unidadeId={unidade.id} trigger={<Button size="sm"><Plus className="size-4 mr-1" /> Incluir licença</Button>} />
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr><th className="p-3">Órgão</th><th className="p-3">CNAE / Atividade</th><th className="p-3">Estado</th><th className="p-3">Nº</th><th className="p-3">Emissão</th><th className="p-3">Vencimento</th><th className="p-3">SEI</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {licencas.map((l: any) => {
                const s = semaforoColor(semaforoOf(l));
                const org = ORGAOS.find(o => o.value === l.orgao);
                return (
                  <LicencaRow key={l.id} l={l} org={org} s={s} unidadeId={unidade.id} documentos={documentos} />
                );
              })}
              {licencas.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma licença registada.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CnaesCard unidadeId={unidade.id} cnaes={cnaes ?? []} />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><UserCog className="size-4" /> Responsáveis Técnicos</CardTitle>
            <RTForm unidadeId={unidade.id} trigger={<Button size="sm" variant="outline"><Plus className="size-4 mr-1" /> Incluir RT</Button>} />
          </CardHeader>
          <CardContent className="space-y-2">
            {responsaveis.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="font-medium text-sm">{r.nome}</div>
                  <div className="text-xs text-muted-foreground">{r.conselho} {r.numero_registro} • {r.cargo}</div>
                  {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                </div>
                <div className="flex gap-1">
                  <RTForm unidadeId={unidade.id} initial={r} trigger={<Button size="icon" variant="ghost" title="Alterar"><Pencil className="size-4" /></Button>} />
                  <DeleteBtn onConfirm={() => deleteRT({ data: { id: r.id } })} qk={["unidade", id]} />
                </div>
              </div>
            ))}
            {responsaveis.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum RT registado.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><FileText className="size-4" /> Documentos gerais</CardTitle>
            <UploadDoc unidadeId={unidade.id} />
          </CardHeader>
          <CardContent className="space-y-2">
            {documentos.filter((d:any)=>!d.licenca_id && d.ativo !== false).map((d: any) => (
              <DocRow key={d.id} d={d} qk={["unidade", id]} unidadeId={unidade.id} />
            ))}
            {documentos.filter((d:any)=>!d.licenca_id && d.ativo !== false).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem documentos gerais.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LicencaRow({ l, org, s, unidadeId, documentos }: any) {
  const [open, setOpen] = useState(false);
  const cn = parseCnae(l.descricao);
  return (
    <>
      <tr className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{org?.label ?? l.orgao}</div>
                      <div className="text-xs text-muted-foreground">{org?.descricao}</div>
                    </td>
                    <td className="p-3">
                      {cn.codigo ? (
                        <>
                          <div className="font-mono text-xs font-medium">{cn.codigo}</div>
                          <div className="text-xs text-muted-foreground max-w-xs truncate" title={cn.label ?? ""}>{cn.label ?? "—"}</div>
                        </>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                    <td className="p-3">{l.numero ?? "—"}</td>
                    <td className="p-3">{formatDate(l.data_emissao)}</td>
                    <td className="p-3">{formatDate(l.data_vencimento)}</td>
                    <td className="p-3 text-xs">{l.processo_sei ?? "—"}</td>
                    <td className="p-3 text-right space-x-1">
                      <Button variant="ghost" size="icon" title="Checklist" onClick={()=>setOpen(o=>!o)}><ListChecks className="size-4" /></Button>
                      <LicencaForm unidadeId={unidadeId} initial={l} trigger={<Button variant="ghost" size="icon" title="Alterar"><Pencil className="size-4" /></Button>} />
                      <DocsInline licencaId={l.id} unidadeId={unidadeId} docs={documentos.filter((d: any)=>d.licenca_id===l.id && d.ativo !== false)} />
                      <DeleteBtn onConfirm={() => deleteLicenca({ data: { id: l.id } })} qk={["unidade", unidadeId]} title="Excluir" />
                    </td>
                  </tr>
      {open && (
        <tr className="bg-muted/20 border-b">
          <td colSpan={8} className="p-4">
            <ChecklistInline licencaId={l.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function ChecklistInline({ licencaId }: { licencaId: string }) {
  const qc = useQueryClient();
  const { data: itens, isLoading } = useQuery({ queryKey: ["checklist", licencaId], queryFn: () => getChecklist({ data: { licenca_id: licencaId } }) });
  const upd = useMutation({
    mutationFn: (patch: any) => updateChecklistItem({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", licencaId] }),
    onError: (e: any) => toast.error(e.message),
  });
  if (isLoading) return <p className="text-xs text-muted-foreground">A carregar checklist…</p>;
  if (!itens || itens.length === 0) return <p className="text-xs text-muted-foreground">Não há template de checklist para este órgão.</p>;
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2"><ListChecks className="size-4" /> Checklist do processo ({itens.length} itens)</div>
      {itens.map((it: any) => (
        <div key={it.id} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2 bg-background">
          <div className="col-span-5">
            <div className="text-sm font-medium">{it.titulo}</div>
            <div className="text-xs text-muted-foreground">{it.tipo === "documento" ? "Documento" : "Etapa"}{it.descricao ? ` • ${it.descricao}` : ""}</div>
          </div>
          <div className="col-span-2">
            <Select value={it.status} onValueChange={(v)=>upd.mutate({ id: it.id, status: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CHECKLIST_STATUS_LABEL).map(([k,v])=> <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Input className="h-8" placeholder="Responsável" defaultValue={it.responsavel ?? ""} onBlur={(e)=>{ if (e.target.value !== (it.responsavel ?? "")) upd.mutate({ id: it.id, responsavel: e.target.value }); }} />
          </div>
          <div className="col-span-2">
            <Input className="h-8" type="date" defaultValue={it.data_conclusao ?? ""} onChange={(e)=>upd.mutate({ id: it.id, data_conclusao: e.target.value || null })} />
          </div>
          <div className="col-span-1 text-xs text-muted-foreground text-right">#{it.ordem}</div>
        </div>
      ))}
    </div>
  );
}

function CnaesCard({ unidadeId, cnaes }: { unidadeId: string; cnaes: any[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>CNAEs sanitários / VISA ({cnaes.length})</CardTitle>
        <CnaeForm unidadeId={unidadeId} trigger={<Button size="sm" variant="outline"><Plus className="size-4 mr-1" /> Incluir CNAE</Button>} />
      </CardHeader>
      <CardContent className="p-0">
        {cnaes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center p-6">Sem CNAEs registados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr><th className="p-3">Código</th><th className="p-3">Descrição</th><th className="p-3">CNPJ SES-DF (legado)</th><th className="p-3">Estado</th><th className="p-3">Vencimento</th><th className="p-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {cnaes.map((c: any) => {
                const s = semaforoColor(c.status);
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{c.codigo}</td>
                    <td className="p-3 text-xs">{c.descricao}</td>
                    <td className="p-3 text-xs">{c.cnpj_ses_legado ?? "—"}</td>
                    <td className="p-3"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                    <td className="p-3 text-xs">{formatDate(c.data_vencimento)}</td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <CnaeForm unidadeId={unidadeId} initial={c} trigger={<Button variant="ghost" size="icon" title="Alterar"><Pencil className="size-4" /></Button>} />
                      <DeleteBtn onConfirm={() => deleteCnae({ data: { id: c.id } })} qk={["unidade", unidadeId]} title="Excluir" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function CnaeForm({ unidadeId, initial, trigger }: { unidadeId: string; initial?: any; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(initial ?? { unidade_id: unidadeId, codigo: "", descricao: "", status: "pendente_declaracao" });
  const m = useMutation({
    mutationFn: (data: any) => upsertCnae({ data: { ...data, unidade_id: unidadeId } }),
    onSuccess: () => { toast.success("CNAE guardado"); qc.invalidateQueries({ queryKey: ["unidade", unidadeId] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{initial ? "Alterar CNAE" : "Novo CNAE"}</SheetTitle></SheetHeader>
        <form className="space-y-3 mt-4 px-4 pb-4" onSubmit={(e)=>{e.preventDefault(); m.mutate(form);}}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Código</Label><Input required placeholder="86.10-1-02" value={form.codigo ?? ""} onChange={(e)=>setForm({...form, codigo: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs">CNPJ SES-DF (legado)</Label><Input value={form.cnpj_ses_legado ?? ""} onChange={(e)=>setForm({...form, cnpj_ses_legado: e.target.value})} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Descrição</Label><Textarea required rows={2} value={form.descricao ?? ""} onChange={(e)=>setForm({...form, descricao: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Estado</Label>
              <Select value={form.status} onValueChange={(v)=>setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_LABEL).map(([k,v])=> <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Vencimento</Label><Input type="date" value={form.data_vencimento ?? ""} onChange={(e)=>setForm({...form, data_vencimento: e.target.value || null})} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Observações</Label><Textarea rows={2} value={form.observacoes ?? ""} onChange={(e)=>setForm({...form, observacoes: e.target.value})} /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" type="button" onClick={()=>setOpen(false)}>Cancelar</Button><Button disabled={m.isPending} type="submit">Guardar</Button></div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DeleteBtn({ onConfirm, qk, title }: { onConfirm: () => Promise<any>; qk: any[]; title?: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title={title ?? "Excluir"}><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Confirmar remoção</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={async ()=>{
            setBusy(true);
            try { await onConfirm(); qc.invalidateQueries({ queryKey: qk }); toast.success("Removido"); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
          }}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LicencaForm({ unidadeId, initial, trigger }: { unidadeId: string; initial?: any; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(initial ?? { unidade_id: unidadeId, orgao: "VISA", status: "nao_iniciado" });
  const m = useMutation({
    mutationFn: (data: any) => upsertLicenca({ data: { ...data, unidade_id: unidadeId } }),
    onSuccess: () => { toast.success("Licença guardada"); qc.invalidateQueries({ queryKey: ["unidade", unidadeId] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["licencas-all"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{initial ? "Editar licença" : "Nova licença"}</SheetTitle></SheetHeader>
        <form className="space-y-3 mt-4 px-4 pb-4" onSubmit={(e)=>{e.preventDefault(); m.mutate(form);}}>
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
            <p className="text-[10px] text-muted-foreground">Identifica a atividade a que a licença se refere.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Data emissão</Label><Input type="date" value={form.data_emissao ?? ""} onChange={(e)=>setForm({...form, data_emissao: e.target.value || null})} /></div>
            <div className="space-y-1"><Label className="text-xs">Data vencimento</Label><Input type="date" value={form.data_vencimento ?? ""} onChange={(e)=>setForm({...form, data_vencimento: e.target.value || null})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Número</Label><Input value={form.numero ?? ""} onChange={(e)=>setForm({...form, numero: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs">Processo SEI</Label><Input value={form.processo_sei ?? ""} onChange={(e)=>setForm({...form, processo_sei: e.target.value})} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Data de protocolo</Label><Input type="date" value={form.data_protocolo ?? ""} onChange={(e)=>setForm({...form, data_protocolo: e.target.value || null})} /></div>
          <div className="space-y-1"><Label className="text-xs">Observações</Label><Textarea rows={3} value={form.observacoes ?? ""} onChange={(e)=>setForm({...form, observacoes: e.target.value})} /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" type="button" onClick={()=>setOpen(false)}>Cancelar</Button><Button disabled={m.isPending} type="submit">{m.isPending ? "A guardar…" : "Guardar"}</Button></div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function RTForm({ unidadeId, initial, trigger }: { unidadeId: string; initial?: any; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(initial ?? { unidade_id: unidadeId, nome: "", conselho: "CRM" });
  const m = useMutation({
    mutationFn: (data: any) => upsertRT({ data: { ...data, unidade_id: unidadeId } }),
    onSuccess: () => { toast.success("RT guardado"); qc.invalidateQueries({ queryKey: ["unidade", unidadeId] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{initial ? "Editar RT" : "Novo Responsável Técnico"}</SheetTitle></SheetHeader>
        <form className="space-y-3 mt-4 px-4 pb-4" onSubmit={(e)=>{e.preventDefault(); m.mutate(form);}}>
          <div className="space-y-1"><Label className="text-xs">Nome</Label><Input required value={form.nome ?? ""} onChange={(e)=>setForm({...form, nome: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Conselho</Label>
              <Select value={form.conselho ?? "CRM"} onValueChange={(v)=>setForm({...form, conselho: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["CRM","COREN","CRF","CRO","CRA","CREA","OUTRO"].map(c=> <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Nº Registo</Label><Input value={form.numero_registro ?? ""} onChange={(e)=>setForm({...form, numero_registro: e.target.value})} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Cargo</Label><Input value={form.cargo ?? ""} onChange={(e)=>setForm({...form, cargo: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={form.cpf ?? ""} onChange={(e)=>setForm({...form, cpf: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs">Telefone</Label><Input value={form.telefone ?? ""} onChange={(e)=>setForm({...form, telefone: e.target.value})} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={form.email ?? ""} onChange={(e)=>setForm({...form, email: e.target.value})} /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" type="button" onClick={()=>setOpen(false)}>Cancelar</Button><Button disabled={m.isPending} type="submit">Guardar</Button></div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function UploadDoc({ unidadeId, licencaId }: { unidadeId: string; licencaId?: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function onFile(f: File) {
    setBusy(true);
    try {
      const path = `${unidadeId}/${licencaId ?? "geral"}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("licencas-docs").upload(path, f);
      if (error) throw error;
      await registrarDocumento({ data: {
        unidade_id: unidadeId, licenca_id: licencaId ?? null,
        categoria: licencaId ? "licenca" : "unidade",
        nome: f.name, storage_path: path, mime_type: f.type, tamanho_bytes: f.size,
      }});
      toast.success("Documento carregado");
      qc.invalidateQueries({ queryKey: ["unidade", unidadeId] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <label>
      <input type="file" hidden onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value=""; }} />
      <Button asChild size="sm" variant="outline" disabled={busy}>
        <span className="cursor-pointer"><Upload className="size-4 mr-1" /> {busy ? "A enviar…" : "Anexar"}</span>
      </Button>
    </label>
  );
}

function DocRow({ d, qk, unidadeId }: { d: any; qk: any[]; unidadeId?: string }) {
  async function download() {
    try {
      const { url } = await signedDocUrl({ data: { path: d.storage_path } });
      window.open(url, "_blank");
    } catch (e: any) { toast.error(e.message); }
  }
  return (
    <div className="flex items-center justify-between border rounded-md p-3 gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{d.nome} {d.versao > 1 && <Badge variant="secondary" className="ml-1 text-[10px]">v{d.versao}</Badge>}</div>
        <div className="text-xs text-muted-foreground">{d.mime_type ?? "—"} • {(d.tamanho_bytes ?? 0)/1024 | 0} KB</div>
      </div>
      {unidadeId && <NovaVersaoBtn documentoId={d.id} unidadeId={unidadeId} qk={qk} />}
      <HistoricoBtn documentoId={d.id} />
      <Button size="icon" variant="ghost" onClick={download}><Download className="size-4" /></Button>
      <DeleteBtn onConfirm={()=>deleteDocumento({ data: { id: d.id, storage_path: d.storage_path } })} qk={qk} />
    </div>
  );
}

function NovaVersaoBtn({ documentoId, unidadeId, qk }: { documentoId: string; unidadeId: string; qk: any[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function onFile(f: File) {
    setBusy(true);
    try {
      const path = `${unidadeId}/versoes/${documentoId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("licencas-docs").upload(path, f);
      if (error) throw error;
      await registrarNovaVersao({ data: { documento_pai_id: documentoId, storage_path: path, mime_type: f.type, tamanho_bytes: f.size } });
      toast.success("Nova versão registada");
      qc.invalidateQueries({ queryKey: qk });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <label title="Nova versão">
      <input type="file" hidden onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value=""; }} />
      <Button asChild size="icon" variant="ghost" disabled={busy}>
        <span className="cursor-pointer"><Upload className="size-4" /></span>
      </Button>
    </label>
  );
}

function HistoricoBtn({ documentoId }: { documentoId: string }) {
  const [open, setOpen] = useState(false);
  const { data: versoes } = useQuery({ queryKey: ["versoes", documentoId], queryFn: () => listVersoesDocumento({ data: { documento_id: documentoId } }), enabled: open });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button size="icon" variant="ghost" title="Histórico"><History className="size-4" /></Button></SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle>Histórico de versões</SheetTitle></SheetHeader>
        <div className="p-4 space-y-2">
          {(versoes ?? []).map((v: any) => (
            <div key={v.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">v{v.versao} {v.ativo && <Badge className="ml-1 text-[10px]">atual</Badge>}</div>
                <Button size="icon" variant="ghost" onClick={async ()=>{ const { url } = await signedDocUrl({ data: { path: v.storage_path } }); window.open(url, "_blank"); }}><Download className="size-4" /></Button>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString("pt-PT")}</div>
              {v.comentario_versao && <div className="text-xs mt-1">{v.comentario_versao}</div>}
            </div>
          ))}
          {(!versoes || versoes.length === 0) && <p className="text-xs text-muted-foreground text-center py-4">Sem versões anteriores.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DocsInline({ licencaId, unidadeId, docs }: { licencaId: string; unidadeId: string; docs: any[] }) {
  return (
    <Sheet>
      <SheetTrigger asChild><Button size="icon" variant="ghost" title="Documentos"><FileText className="size-4" /></Button></SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle>Documentos da licença</SheetTitle></SheetHeader>
        <div className="p-4 space-y-2">
          <UploadDoc unidadeId={unidadeId} licencaId={licencaId} />
          {docs.map(d => <DocRow key={d.id} d={d} qk={["unidade", unidadeId]} unidadeId={unidadeId} />)}
          {docs.length===0 && <p className="text-sm text-muted-foreground text-center py-4">Sem documentos.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
