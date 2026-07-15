import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUnidades, upsertUnidade } from "@/lib/licencas.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TIPO_UNIDADE_LABEL, TipoUnidade } from "@/lib/domain";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["unidades"], queryFn: () => listUnidades() });

export const Route = createFileRoute("/_authenticated/unidades")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: UnidadesPage,
  head: () => ({ meta: [{ title: "Unidades — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem unidades.</div>,
});

function UnidadesPage() {
  const { data } = useSuspenseQuery(opts);
  const [q, setQ] = useState("");
  const filtered = data.filter((u: any) => (u.nome + " " + (u.cnpj ?? "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-8 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Unidades</h1>
          <p className="text-sm text-muted-foreground">{data.length} unidades registadas na rede IGESDF.</p>
        </div>
        <UnidadeForm trigger={<Button><Plus className="size-4 mr-1" /> Nova unidade</Button>} />
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Procurar por nome ou CNPJ…" value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((u: any) => (
          <Link key={u.id} to="/unidades/$id" params={{id: u.id}}>
            <Card className="hover:border-primary/50 transition cursor-pointer h-full">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Nº {u.numero_iges ?? "—"}</div>
                    <div className="font-semibold leading-tight">{u.nome}</div>
                  </div>
                  <Badge variant="secondary">{TIPO_UNIDADE_LABEL[u.tipo as TipoUnidade] ?? u.tipo}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>CNPJ: {u.cnpj ?? "—"}</div>
                  <div className="line-clamp-2">{u.endereco ?? "Sem endereço"}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function UnidadeForm({ trigger, initial }: { trigger: React.ReactNode; initial?: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(initial ?? { nome: "", tipo: "hospital" });
  const m = useMutation({
    mutationFn: (data: any) => upsertUnidade({ data }),
    onSuccess: () => {
      toast.success("Unidade guardada");
      qc.invalidateQueries({ queryKey: ["unidades"] });
      qc.invalidateQueries({ queryKey: ["unidade"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{initial ? "Editar unidade" : "Nova unidade"}</SheetTitle></SheetHeader>
        <form className="space-y-3 mt-4 px-4 pb-4" onSubmit={(e)=>{e.preventDefault(); m.mutate(form);}}>
          <Field label="Nome"><Input required value={form.nome ?? ""} onChange={(e)=>setForm({...form, nome: e.target.value})} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={form.tipo} onValueChange={(v)=>setForm({...form, tipo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_UNIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nº IGES"><Input type="number" value={form.numero_iges ?? ""} onChange={(e)=>setForm({...form, numero_iges: e.target.value ? parseInt(e.target.value) : null})} /></Field>
          </div>
          <Field label="CNPJ"><Input value={form.cnpj ?? ""} onChange={(e)=>setForm({...form, cnpj: e.target.value})} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CF/DF"><Input value={form.cf_df ?? ""} onChange={(e)=>setForm({...form, cf_df: e.target.value})} /></Field>
            <Field label="Processo SEI"><Input value={form.processo_sei ?? ""} onChange={(e)=>setForm({...form, processo_sei: e.target.value})} /></Field>
          </div>
          <Field label="Endereço"><Textarea rows={2} value={form.endereco ?? ""} onChange={(e)=>setForm({...form, endereco: e.target.value})} /></Field>
          <Field label="Observações"><Textarea rows={3} value={form.observacoes ?? ""} onChange={(e)=>setForm({...form, observacoes: e.target.value})} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button disabled={m.isPending} type="submit">{m.isPending ? "A guardar…" : "Guardar"}</Button></div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
