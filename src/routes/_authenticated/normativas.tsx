import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { listNormativas, upsertNormativa, deleteNormativa } from "@/lib/normativas.functions";
import { signedDocUrl } from "@/lib/licencas.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ExternalLink, Star, Printer, Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/domain";

const opts = queryOptions({ queryKey: ["normativas"], queryFn: () => listNormativas() });

const TIPOS: { value: string; label: string }[] = [
  { value: "rdc", label: "RDC (ANVISA)" },
  { value: "normativa", label: "Normativa / Nota técnica" },
  { value: "portaria", label: "Portaria" },
  { value: "instrucao_normativa", label: "Instrução normativa" },
  { value: "resolucao", label: "Resolução" },
  { value: "lei", label: "Lei" },
  { value: "decreto", label: "Decreto" },
  { value: "processo_sei", label: "Processo SEI" },
  { value: "outro", label: "Outro" },
];
const TIPO_LABEL = Object.fromEntries(TIPOS.map(t => [t.value, t.label]));
const SITUACOES = [
  { value: "vigente", label: "Vigente" },
  { value: "revogada", label: "Revogada" },
  { value: "substituida", label: "Substituída" },
  { value: "em_consulta", label: "Em consulta pública" },
];
const SITUACAO_LABEL = Object.fromEntries(SITUACOES.map(s => [s.value, s.label]));
const AMBITOS = [
  { value: "federal", label: "Federal" },
  { value: "distrital", label: "Distrital (DF)" },
  { value: "interno", label: "Interno (IGESDF)" },
];
const AMBITO_LABEL = Object.fromEntries(AMBITOS.map(a => [a.value, a.label]));
const APLICACOES = ["UPAs", "Hospitais", "Administrativo", "Laboratório"];

export const Route = createFileRoute("/_authenticated/normativas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: NormativasPage,
  head: () => ({
    meta: [
      { title: "Normativas e Processos SEI — IGESDF Compliance" },
      { name: "description", content: "Arquivo de RDCs da ANVISA, normativas da VISADF, portarias, leis e processos SEI aplicáveis ao licenciamento de UPAs e hospitais do IGESDF." },
      { property: "og:title", content: "Normativas, Portarias e Processos SEI — IGESDF" },
      { property: "og:description", content: "Base legal do licenciamento sanitário e ambiental das unidades do IGESDF." },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/normativas" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/normativas" }],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Sem normativas.</div>,
});

function NormativasPage() {
  const { data } = useSuspenseQuery(opts);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [ambito, setAmbito] = useState("todos");
  const [aplic, setAplic] = useState("todas");

  const filtered = data.filter((n: any) => {
    if (tipo !== "todos" && n.tipo !== tipo) return false;
    if (ambito !== "todos" && n.ambito !== ambito) return false;
    if (aplic !== "todas" && !(n.aplicacao ?? []).includes(aplic)) return false;
    const hay = `${n.tipo} ${n.numero} ${n.ano ?? ""} ${n.orgao_sigla} ${n.titulo} ${n.ementa ?? ""} ${(n.tags ?? []).join(" ")}`.toLowerCase();
    return !q || hay.includes(q.toLowerCase());
  });

  return (
    <div className="p-8 space-y-4 print-area">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Normativas, Portarias e Processos SEI</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {data.length} documentos normativos arquivados.</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-1" /> Imprimir / PDF</Button>
          <NormativaForm trigger={<Button><Plus className="size-4 mr-1" /> Incluir normativa</Button>} />
        </div>
      </header>

      <div className="grid gap-2 md:grid-cols-4 no-print">
        <Input placeholder="Procurar por número, título, ementa ou etiqueta…" value={q} onChange={(e)=>setQ(e.target.value)} />
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ambito} onValueChange={setAmbito}>
          <SelectTrigger aria-label="Filtrar por âmbito"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os âmbitos</SelectItem>
            {AMBITOS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={aplic} onValueChange={setAplic}>
          <SelectTrigger aria-label="Filtrar por aplicação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as aplicações</SelectItem>
            {APLICACOES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {filtered.map((n: any) => <NormativaCard key={n.id} n={n} />)}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento corresponde aos filtros.</p>}
      </div>
    </div>
  );
}

function NormativaCard({ n }: { n: any }) {
  return (
    <Card className={n.principal ? "border-primary" : undefined}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {n.principal && <Badge className="gap-1"><Star className="size-3" /> Principal</Badge>}
              <Badge variant="secondary" className="font-mono text-xs">{n.orgao_sigla}</Badge>
              <Badge variant="outline" className="text-xs">{TIPO_LABEL[n.tipo] ?? n.tipo}</Badge>
              <Badge variant="outline" className="text-xs">{AMBITO_LABEL[n.ambito] ?? n.ambito}</Badge>
              <Badge variant={n.situacao === "vigente" ? "secondary" : "outline"} className="text-xs">{SITUACAO_LABEL[n.situacao] ?? n.situacao}</Badge>
            </div>
            <div className="font-medium leading-tight">
              {(TIPO_LABEL[n.tipo] ?? "").split(" ")[0]} nº {n.numero}{n.ano ? `/${n.ano}` : ""} — {n.titulo}
            </div>
            {n.ementa && <p className="text-sm text-muted-foreground">{n.ementa}</p>}
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              {n.data_publicacao && <span>Publicação: {formatDate(n.data_publicacao)}</span>}
              {(n.aplicacao ?? []).length > 0 && <span>Aplica-se a: {n.aplicacao.join(", ")}</span>}
              {(n.tags ?? []).length > 0 && <span>Etiquetas: {n.tags.join(", ")}</span>}
            </div>
            <div className="flex items-center gap-3 text-xs pt-1">
              {n.link && (
                <a href={n.link} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
                  <ExternalLink className="size-3" /> Texto oficial
                </a>
              )}
              {n.storage_path && (
                <button
                  className="underline inline-flex items-center gap-1 no-print"
                  onClick={async ()=>{ const { url } = await signedDocUrl({ data: { path: n.storage_path } }); window.open(url, "_blank"); }}
                >
                  <Download className="size-3" /> Ficheiro anexado
                </button>
              )}
            </div>
            {n.observacoes && <p className="text-xs text-muted-foreground italic">{n.observacoes}</p>}
          </div>
          <div className="flex gap-1 shrink-0 no-print">
            <NormativaForm normativa={n} trigger={<Button size="icon" variant="ghost"><Pencil className="size-4" /></Button>} />
            <NormativaDelete id={n.id} numero={n.numero} storage_path={n.storage_path} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NormativaForm({ normativa, trigger }: { normativa?: any; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<any>(() => normativa ?? {
    tipo: "rdc", numero: "", ano: new Date().getFullYear(), orgao_sigla: "ANVISA", titulo: "", ementa: "",
    ambito: "federal", aplicacao: [], data_publicacao: "", situacao: "vigente", link: "", storage_path: null,
    tags: [], principal: false, observacoes: "",
  });

  const m = useMutation({
    mutationFn: (payload: any) => upsertNormativa({ data: payload }),
    onSuccess: () => { toast.success(normativa ? "Normativa atualizada" : "Normativa criada"); qc.invalidateQueries({ queryKey: ["normativas"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const path = `normativas/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("licencas-docs").upload(path, file);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setForm((f: any) => ({ ...f, storage_path: path }));
    toast.success("Ficheiro carregado");
  }

  function toggleAplic(a: string) {
    setForm((f: any) => {
      const cur: string[] = f.aplicacao ?? [];
      return { ...f, aplicacao: cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a] };
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[460px] sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{normativa ? "Alterar normativa" : "Incluir normativa"}</SheetTitle></SheetHeader>
        <form className="space-y-3 mt-4" onSubmit={(e)=>{
          e.preventDefault();
          m.mutate({
            ...form,
            id: normativa?.id,
            ano: form.ano ? Number(form.ano) : null,
            tags: typeof form.tags === "string" ? form.tags.split(",").map((t: string)=>t.trim()).filter(Boolean) : (form.tags ?? []),
          });
        }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v)=>setForm({...form, tipo: v})}>
                <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="orgao">Órgão emissor *</Label>
              <Input id="orgao" required value={form.orgao_sigla} onChange={(e)=>setForm({...form, orgao_sigla: e.target.value.toUpperCase()})} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><Label htmlFor="numero">Número *</Label><Input id="numero" required value={form.numero} onChange={(e)=>setForm({...form, numero: e.target.value})} /></div>
            <div><Label htmlFor="ano">Ano</Label><Input id="ano" type="number" value={form.ano ?? ""} onChange={(e)=>setForm({...form, ano: e.target.value})} /></div>
          </div>
          <div><Label htmlFor="titulo">Título *</Label><Input id="titulo" required value={form.titulo} onChange={(e)=>setForm({...form, titulo: e.target.value})} /></div>
          <div><Label htmlFor="ementa">Ementa</Label><Textarea id="ementa" rows={4} value={form.ementa ?? ""} onChange={(e)=>setForm({...form, ementa: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ambito">Âmbito *</Label>
              <Select value={form.ambito} onValueChange={(v)=>setForm({...form, ambito: v})}>
                <SelectTrigger id="ambito"><SelectValue /></SelectTrigger>
                <SelectContent>{AMBITOS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="situacao">Situação *</Label>
              <Select value={form.situacao} onValueChange={(v)=>setForm({...form, situacao: v})}>
                <SelectTrigger id="situacao"><SelectValue /></SelectTrigger>
                <SelectContent>{SITUACOES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Aplica-se a</Label>
            <div className="flex flex-wrap gap-3 mt-1 text-sm">
              {APLICACOES.map(a => (
                <label key={a} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={(form.aplicacao ?? []).includes(a)} onChange={()=>toggleAplic(a)} />
                  {a}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label htmlFor="pub">Data de publicação</Label><Input id="pub" type="date" value={form.data_publicacao ?? ""} onChange={(e)=>setForm({...form, data_publicacao: e.target.value})} /></div>
            <div><Label htmlFor="tags">Etiquetas (vírgulas)</Label><Input id="tags" value={Array.isArray(form.tags) ? form.tags.join(", ") : (form.tags ?? "")} onChange={(e)=>setForm({...form, tags: e.target.value})} /></div>
          </div>
          <div><Label htmlFor="link">Link oficial</Label><Input id="link" value={form.link ?? ""} onChange={(e)=>setForm({...form, link: e.target.value})} placeholder="https://…" /></div>
          <div>
            <Label htmlFor="file">Ficheiro (PDF)</Label>
            <Input id="file" type="file" accept="application/pdf,image/*" onChange={(e)=>onUpload(e.target.files?.[0])} />
            {uploading && <p className="text-xs text-muted-foreground mt-1"><Upload className="size-3 inline mr-1" />A carregar…</p>}
            {form.storage_path && <p className="text-xs text-muted-foreground mt-1 truncate">Anexo: {form.storage_path.split("/").pop()}</p>}
          </div>
          <div><Label htmlFor="obs">Observações</Label><Textarea id="obs" rows={2} value={form.observacoes ?? ""} onChange={(e)=>setForm({...form, observacoes: e.target.value})} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.principal} onChange={(e)=>setForm({...form, principal: e.target.checked})} />
            Marcar como normativa principal de licenciamento
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending || uploading}>{m.isPending ? "A guardar…" : "Guardar"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function NormativaDelete({ id, numero, storage_path }: { id: string; numero: string; storage_path?: string | null }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => deleteNormativa({ data: { id, storage_path: storage_path ?? null } }),
    onSuccess: () => { toast.success("Normativa excluída"); qc.invalidateQueries({ queryKey: ["normativas"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir nº {numero}?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação é permanente e remove também o ficheiro anexado.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={()=>m.mutate()}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
