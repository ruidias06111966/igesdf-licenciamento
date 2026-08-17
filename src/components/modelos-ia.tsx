import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookMarked, Download, FileDown, Paperclip, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, FieldRow, FormSheet } from "@/components/form-sheet";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { anexarModelo, deleteModelo, listModelos, upsertModelo } from "@/lib/modelos.functions";
import { exportarDocumento, FORMATOS, type Formato } from "@/lib/exportar-documento";
import { mensagemErro } from "@/lib/errors";
import { processosQuery, unidadesQuery } from "@/lib/queries";

export const modelosQuery = queryOptions({
  queryKey: ["ia-modelos"],
  queryFn: () => listModelos(),
});

const TIPOS = [
  ["despacho", "Despacho"],
  ["oficio", "Ofício"],
  ["relatorio", "Relatório"],
  ["memorando", "Memorando"],
  ["checklist", "Checklist"],
  ["parecer", "Parecer"],
  ["outro", "Outro"],
] as const;

type Tipo = (typeof TIPOS)[number][0];
type Valores = { titulo: string; tipo: Tipo; conteudo: string; tags: string };

/** Guarda a resposta do assistente na biblioteca de documentos padrão. */
export function GuardarModelo({ conteudo }: { conteudo: string }) {
  const qc = useQueryClient();
  const guardar = useMutation({
    mutationFn: (v: Valores) =>
      upsertModelo({
        data: {
          titulo: v.titulo,
          tipo: v.tipo,
          conteudo: v.conteudo,
          tags: v.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Documento guardado nos modelos");
      void qc.invalidateQueries({ queryKey: modelosQuery.queryKey });
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<Valores>
      titulo="Guardar como documento padrão"
      descricao="Fica na biblioteca de modelos para reutilizar, exportar ou anexar a um processo."
      rotuloSalvar="Guardar modelo"
      trigger={
        <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs">
          <Save className="mr-1 size-3" aria-hidden="true" /> Guardar como modelo
        </Button>
      }
      valorInicial={() => ({
        titulo: primeiraLinha(conteudo),
        tipo: "despacho" as Tipo,
        conteudo,
        tags: "",
      })}
      podeSalvar={(v) => v.titulo.trim().length >= 3 && v.conteudo.trim().length > 0}
      onSubmit={(v) => guardar.mutateAsync(v)}
    >
      {(v, definir) => (
        <>
          <FieldRow>
            <Field label="Título" obrigatorio htmlFor="modelo-titulo">
              <Input
                id="modelo-titulo"
                value={v.titulo}
                onChange={(e) => definir("titulo", e.target.value)}
              />
            </Field>
            <Field label="Tipo de documento" htmlFor="modelo-tipo">
              <Select value={v.tipo} onValueChange={(valor) => definir("tipo", valor as Tipo)}>
                <SelectTrigger id="modelo-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>
          <Field
            label="Etiquetas"
            htmlFor="modelo-tags"
            dica="Separadas por vírgula. Ex.: VISADF, renovação"
          >
            <Input
              id="modelo-tags"
              value={v.tags}
              onChange={(e) => definir("tags", e.target.value)}
            />
          </Field>
          <Field label="Conteúdo" obrigatorio htmlFor="modelo-conteudo">
            <Textarea
              id="modelo-conteudo"
              rows={18}
              className="font-mono text-xs"
              value={v.conteudo}
              onChange={(e) => definir("conteudo", e.target.value)}
            />
          </Field>
        </>
      )}
    </FormSheet>
  );
}

function primeiraLinha(conteudo: string) {
  const linha = conteudo
    .split("\n")
    .map((l) =>
      l
        .replace(/^#+\s*/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .find((l) => l.length > 3);
  return (linha ?? "Documento do assistente").slice(0, 120);
}

function MenuExportar({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Download className="mr-1 size-3.5" aria-hidden="true" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {FORMATOS.map((f) => (
          <DropdownMenuItem
            key={f.valor}
            onSelect={() => {
              void exportarDocumento(f.valor as Formato, titulo, conteudo).catch((e) =>
                toast.error(mensagemErro(e)),
              );
            }}
          >
            <FileDown className="mr-2 size-3.5" aria-hidden="true" />
            <span className="flex flex-col">
              <span>{f.rotulo}</span>
              <span className="text-[11px] text-muted-foreground">{f.descricao}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AnexarModelo({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [destino, setDestino] = useState<string>("");
  const { data: unidades } = useQuery(unidadesQuery);
  const { data: processos } = useQuery(processosQuery);
  const qc = useQueryClient();

  const anexar = useMutation({
    mutationFn: () => {
      const [tipo, alvo] = destino.split(":");
      return anexarModelo({
        data: {
          id,
          unidade_id: tipo === "unidade" ? alvo : null,
          processo_id: tipo === "processo" ? alvo : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Documento anexado");
      setAberto(false);
      setDestino("");
      void qc.invalidateQueries();
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Paperclip className="mr-1 size-3.5" aria-hidden="true" /> Anexar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Anexar aos documentos</DialogTitle>
          <DialogDescription className="text-xs">
            O documento fica arquivado junto dos restantes anexos da unidade ou do processo SEI.
          </DialogDescription>
        </DialogHeader>
        <Select value={destino} onValueChange={setDestino}>
          <SelectTrigger aria-label="Escolher destino">
            <SelectValue placeholder="Escolher unidade ou processo…" />
          </SelectTrigger>
          <SelectContent>
            {(unidades ?? []).map((u) => (
              <SelectItem key={u.id} value={`unidade:${u.id}`}>
                Unidade — {u.nome}
              </SelectItem>
            ))}
            {(processos ?? []).map((p) => (
              <SelectItem key={p.id} value={`processo:${p.id}`}>
                Processo SEI — {p.numero}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button disabled={!destino || anexar.isPending} onClick={() => anexar.mutate()}>
            {anexar.isPending ? "A anexar…" : "Anexar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Biblioteca de documentos padrão guardados a partir do assistente. */
export function BibliotecaModelos({ onUsar }: { onUsar: (conteudo: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const { data: modelos, isLoading } = useQuery({ ...modelosQuery, enabled: aberto });
  const qc = useQueryClient();

  const apagar = useMutation({
    mutationFn: (id: string) => deleteModelo({ data: { id } }),
    onSuccess: () => {
      toast.success("Modelo removido");
      void qc.invalidateQueries({ queryKey: modelosQuery.queryKey });
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookMarked className="mr-2 size-4" aria-hidden="true" /> Modelos guardados
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1000px]">
        <DialogHeader className="border-b p-4 pr-12 text-left">
          <DialogTitle>Documentos padrão</DialogTitle>
          <DialogDescription className="text-xs">
            Despachos, ofícios e relatórios guardados do assistente. Reutilize no chat, exporte em
            PDF/Word/texto ou anexe a uma unidade ou processo.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
          {!isLoading && (modelos ?? []).length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Ainda não há documentos guardados. Use “Guardar como modelo” numa resposta do
              assistente.
            </p>
          )}
          {(modelos ?? []).map((m) => (
            <article key={m.id} className="rounded-lg border p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate text-sm font-semibold">{m.titulo}</h3>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {m.tipo}
                    </Badge>
                    {(m.tags ?? []).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {m.conteudo.replace(/[#*]/g, "").slice(0, 240)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onUsar(m.conteudo);
                      setAberto(false);
                    }}
                  >
                    Usar no chat
                  </Button>
                  <MenuExportar titulo={m.titulo} conteudo={m.conteudo} />
                  <AnexarModelo id={m.id} />
                  <ConfirmDelete
                    titulo="Remover modelo"
                    descricao={`O documento "${m.titulo}" será apagado da biblioteca.`}
                    onConfirm={() => apagar.mutateAsync(m.id)}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Remover modelo">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
