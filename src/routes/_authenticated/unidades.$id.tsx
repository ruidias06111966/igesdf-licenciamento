import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUnidade, upsertLicenca, deleteLicenca, upsertRT, deleteRT, registrarDocumento, deleteDocumento, signedDocUrl } from "@/lib/licencas.functions";
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
import { ORGAOS, STATUS_LABEL, semaforoColor, formatDate, StatusLicenca } from "@/lib/domain";
import { ArrowLeft, Plus, Pencil, Trash2, Upload, Download, FileText, UserCog } from "lucide-react";
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
  const { data } = useSuspenseQuery(unidadeOpts(id));
  const { unidade, licencas, responsaveis, documentos } = data;

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
        <UnidadeForm initial={unidade} trigger={<Button variant="outline"><Pencil className="size-4 mr-1" /> Editar unidade</Button>} />
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Licenças e Alvarás ({licencas.length})</CardTitle>
          <LicencaForm unidadeId={unidade.id} trigger={<Button size="sm"><Plus className="size-4 mr-1" /> Adicionar</Button>} />
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr><th className="p-3">Órgão</th><th className="p-3">Estado</th><th className="p-3">Nº</th><th className="p-3">Emissão</th><th className="p-3">Vencimento</th><th className="p-3">Processo SEI</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {licencas.map((l: any) => {
                const s = semaforoColor(semaforoOf(l));
                const org = ORGAOS.find(o => o.value === l.orgao);
                return (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{org?.label ?? l.orgao}</div>
                      <div className="text-xs text-muted-foreground">{org?.descricao}</div>
                    </td>
                    <td className="p-3"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                    <td className="p-3">{l.numero ?? "—"}</td>
                    <td className="p-3">{formatDate(l.data_emissao)}</td>
                    <td className="p-3">{formatDate(l.data_vencimento)}</td>
                    <td className="p-3 text-xs">{l.processo_sei ?? "—"}</td>
                    <td className="p-3 text-right space-x-1">
                      <LicencaForm unidadeId={unidade.id} initial={l} trigger={<Button variant="ghost" size="icon"><Pencil className="size-4" /></Button>} />
                      <DocsInline licencaId={l.id} unidadeId={unidade.id} docs={documentos.filter((d: any)=>d.licenca_id===l.id)} />
                      <DeleteBtn onConfirm={() => deleteLicenca({ data: { id: l.id } })} qk={["unidade", id]} />
                    </td>
                  </tr>
                );
              })}
              {licencas.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma licença registada.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><UserCog className="size-4" /> Responsáveis Técnicos</CardTitle>
            <RTForm unidadeId={unidade.id} trigger={<Button size="sm" variant="outline"><Plus className="size-4 mr-1" /> RT</Button>} />
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
                  <RTForm unidadeId={unidade.id} initial={r} trigger={<Button size="icon" variant="ghost"><Pencil className="size-4" /></Button>} />
                  <DeleteBtn onConfirm={() => deleteRT({ data: { id: r.id } })} qk={["unidade", id]} />
                </div>
              </div>
            ))}
            {responsaveis.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum RT registado.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><FileText className="size-4" /> Documentos da unidade</CardTitle>
            <UploadDoc unidadeId={unidade.id} />
          </CardHeader>
          <CardContent className="space-y-2">
            {documentos.filter((d:any)=>!d.licenca_id).map((d: any) => (
              <DocRow key={d.id} d={d} qk={["unidade", id]} />
            ))}
            {documentos.filter((d:any)=>!d.licenca_id).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem documentos gerais.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeleteBtn({ onConfirm, qk }: { onConfirm: () => Promise<any>; qk: any[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger>
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

function DocRow({ d, qk }: { d: any; qk: any[] }) {
  async function download() {
    try {
      const { url } = await signedDocUrl({ data: { path: d.storage_path } });
      window.open(url, "_blank");
    } catch (e: any) { toast.error(e.message); }
  }
  return (
    <div className="flex items-center justify-between border rounded-md p-3 gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{d.nome}</div>
        <div className="text-xs text-muted-foreground">{d.mime_type} • {(d.tamanho_bytes ?? 0)/1024 | 0} KB</div>
      </div>
      <Button size="icon" variant="ghost" onClick={download}><Download className="size-4" /></Button>
      <DeleteBtn onConfirm={()=>deleteDocumento({ data: { id: d.id, storage_path: d.storage_path } })} qk={qk} />
    </div>
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
          {docs.map(d => <DocRow key={d.id} d={d} qk={["unidade", unidadeId]} />)}
          {docs.length===0 && <p className="text-sm text-muted-foreground text-center py-4">Sem documentos.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
