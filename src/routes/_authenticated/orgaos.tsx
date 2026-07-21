import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { listOrgaos, upsertOrgao, deleteOrgao } from "@/lib/orgaos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["orgaos"], queryFn: () => listOrgaos() });

export const Route = createFileRoute("/_authenticated/orgaos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: OrgaosPage,
  head: () => ({ meta: [{ title: "Órgãos — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem órgãos.</div>,
});

function OrgaosPage() {
  const { data } = useSuspenseQuery(opts);
  const [q, setQ] = useState("");
  const filtered = data.filter((o: any) =>
    !q || (o.sigla + " " + o.nome + " " + (o.categoria ?? "")).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-8 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Órgãos reguladores</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {data.length} órgãos cadastrados.</p>
        </div>
        <OrgaoForm trigger={<Button><Plus className="size-4 mr-1" /> Incluir órgão</Button>} />
      </header>
      <Input placeholder="Procurar por sigla, nome ou categoria…" value={q} onChange={(e)=>setQ(e.target.value)} className="max-w-md" />
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((o: any) => (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono text-xs">{o.sigla}</Badge>
                    {o.ativo === false && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                  </div>
                  <div className="font-medium mt-1 leading-tight">{o.nome}</div>
                  {o.categoria && <div className="text-xs text-muted-foreground mt-0.5">{o.categoria}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <OrgaoForm orgao={o} trigger={<Button size="icon" variant="ghost"><Pencil className="size-4" /></Button>} />
                  <OrgaoDelete id={o.id} sigla={o.sigla} />
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {o.site && (
                  <div className="flex items-center gap-1">
                    <ExternalLink className="size-3" />
                    <a href={o.site.startsWith("http") ? o.site : `https://${o.site}`} target="_blank" rel="noreferrer" className="underline truncate">{o.site}</a>
                  </div>
                )}
                {o.telefone && <div>Tel: {o.telefone}</div>}
                {o.email && <div>Email: {o.email}</div>}
                {o.endereco && <div>End.: {o.endereco}</div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OrgaoForm({ orgao, trigger }: { orgao?: any; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(() => orgao ?? { sigla: "", nome: "", categoria: "", site: "", telefone: "", email: "", endereco: "", observacoes: "", ativo: true });
  const m = useMutation({
    mutationFn: (payload: any) => upsertOrgao({ data: payload }),
    onSuccess: () => { toast.success(orgao ? "Órgão atualizado" : "Órgão criado"); qc.invalidateQueries({ queryKey: ["orgaos"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[420px] sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{orgao ? "Alterar órgão" : "Incluir órgão"}</SheetTitle></SheetHeader>
        <form className="space-y-3 mt-4" onSubmit={(e)=>{ e.preventDefault(); m.mutate({ ...form, id: orgao?.id }); }}>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1"><Label>Sigla *</Label><Input required maxLength={30} value={form.sigla} onChange={(e)=>setForm({...form, sigla: e.target.value.toUpperCase()})} /></div>
            <div className="col-span-2"><Label>Categoria</Label><Input value={form.categoria ?? ""} onChange={(e)=>setForm({...form, categoria: e.target.value})} /></div>
          </div>
          <div><Label>Nome oficial *</Label><Input required value={form.nome} onChange={(e)=>setForm({...form, nome: e.target.value})} /></div>
          <div><Label>Site</Label><Input value={form.site ?? ""} onChange={(e)=>setForm({...form, site: e.target.value})} placeholder="https://…" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e)=>setForm({...form, telefone: e.target.value})} /></div>
            <div><Label>Email</Label><Input value={form.email ?? ""} onChange={(e)=>setForm({...form, email: e.target.value})} /></div>
          </div>
          <div><Label>Endereço</Label><Input value={form.endereco ?? ""} onChange={(e)=>setForm({...form, endereco: e.target.value})} /></div>
          <div><Label>Observações</Label><Textarea rows={3} value={form.observacoes ?? ""} onChange={(e)=>setForm({...form, observacoes: e.target.value})} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.ativo !== false} onChange={(e)=>setForm({...form, ativo: e.target.checked})} />
            Ativo
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "A guardar…" : "Guardar"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function OrgaoDelete({ id, sigla }: { id: string; sigla: string }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => deleteOrgao({ data: { id } }),
    onSuccess: () => { toast.success("Órgão excluído"); qc.invalidateQueries({ queryKey: ["orgaos"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {sigla}?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação é permanente. Só é permitida se não houver licenças associadas.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={()=>m.mutate()}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}