import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookMarked, Download, FileDown, History, Paperclip, Save, Trash2 } from "lucide-react";
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
import {
  anexarModelo,
  deleteModelo,
  listModelos,
  listVersoesModelo,
  restaurarVersaoModelo,
  upsertModelo,
} from "@/lib/modelos.functions";
import {
  ORGAO_VALUES,
  TIPOS_MODELO,
  TIPOS_UNIDADE_MODELO,
  type TipoModelo,
} from "@/lib/modelos-schema";
import { orgaoLabel } from "@/lib/domain";
import { exportarDocumento, FORMATOS, type Formato } from "@/lib/exportar-documento";
import { mensagemErro } from "@/lib/errors";
import { processosQuery, unidadesQuery } from "@/lib/queries";
import { dataHora, PERFIL_LABEL } from "@/lib/auditoria-labels";

export const modelosQuery = queryOptions({
  queryKey: ["ia-modelos"],
  queryFn: () => listModelos(),
});

const TODOS = "__todos__";
const NENHUM = "__nenhum__";

const TIPO_UNIDADE_LABEL: Record<string, string> = {
  hospital: "Hospital",
  upa: "UPA",
  administrativo: "Administrativo",
  laboratorio: "Laboratório",
  outro: "Outro",
};

type Valores = {
  titulo: string;
  tipo: TipoModelo;
  conteudo: string;
  tags: string;
  orgao: string;
  tipo_unidade: string;
};

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
          orgao: v.orgao === NENHUM ? null : (v.orgao as (typeof ORGAO_VALUES)[number]),
          tipo_unidade:
            v.tipo_unidade === NENHUM
              ? null
              : (v.tipo_unidade as (typeof TIPOS_UNIDADE_MODELO)[number]),
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
        tipo: "despacho" as TipoModelo,
        conteudo,
        tags: "",
        orgao: NENHUM,
        tipo_unidade: NENHUM,
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
              <Select
                value={v.tipo}
                onValueChange={(valor) => definir("tipo", valor as TipoModelo)}
              >
                <SelectTrigger id="modelo-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_MODELO.map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field
              label="Órgão"
              htmlFor="modelo-orgao"
              dica="Classifica o modelo para o encontrar depressa."
            >
              <Select value={v.orgao} onValueChange={(valor) => definir("orgao", valor)}>
                <SelectTrigger id="modelo-orgao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Sem órgão específico</SelectItem>
                  {ORGAO_VALUES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {orgaoLabel(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de unidade" htmlFor="modelo-tipo-unidade">
              <Select
                value={v.tipo_unidade}
                onValueChange={(valor) => definir("tipo_unidade", valor)}
              >
                <SelectTrigger id="modelo-tipo-unidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>Qualquer unidade</SelectItem>
                  {TIPOS_UNIDADE_MODELO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_UNIDADE_LABEL[t]}
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

/** Histórico de versões de um modelo, com reposição de uma versão anterior. */
function VersoesModelo({ id, versao }: { id: string; versao: number }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ia-modelo-versoes", id],
    queryFn: () => listVersoesModelo({ data: { modelo_id: id } }),
    enabled: aberto,
  });

  const repor = useMutation({
    mutationFn: (versao_id: string) =>
      restaurarVersaoModelo({ data: { modelo_id: id, versao_id } }),
    onSuccess: () => {
      toast.success("Versão reposta");
      setAberto(false);
      void qc.invalidateQueries({ queryKey: modelosQuery.queryKey });
      void qc.invalidateQueries({ queryKey: ["ia-modelo-versoes", id] });
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <History className="mr-1 size-3.5" aria-hidden="true" /> v{versao}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Versões do modelo</DialogTitle>
          <DialogDescription className="text-xs">
            Gravar por cima arquiva a versão anterior. Pode repor qualquer uma — a atual fica também
            guardada.
          </DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
        {data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ainda não há versões anteriores: este modelo nunca foi alterado.
          </p>
        )}
        <ul className="space-y-2">
          {(data ?? []).map((v) => (
            <li key={v.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    v{v.versao} — {v.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dataHora(v.created_at)}
                    {v.perfil ? ` · Perfil ${PERFIL_LABEL[v.perfil] ?? v.perfil}` : ""}
                    {v.comentario ? ` · ${v.comentario}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={repor.isPending}
                  onClick={() => repor.mutate(v.id)}
                >
                  Repor esta versão
                </Button>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                {v.conteudo.replace(/[#*]/g, "").slice(0, 300)}
              </p>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
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
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState(TODOS);
  const [orgao, setOrgao] = useState(TODOS);
  const [tipoUnidade, setTipoUnidade] = useState(TODOS);
  const { data: modelos, isLoading } = useQuery({ ...modelosQuery, enabled: aberto });
  const qc = useQueryClient();

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (modelos ?? []).filter((m) => {
      if (tipo !== TODOS && m.tipo !== tipo) return false;
      if (orgao !== TODOS && m.orgao !== orgao) return false;
      if (tipoUnidade !== TODOS && m.tipo_unidade !== tipoUnidade) return false;
      if (!termo) return true;
      return `${m.titulo} ${(m.tags ?? []).join(" ")} ${m.conteudo}`.toLowerCase().includes(termo);
    });
  }, [modelos, busca, tipo, orgao, tipoUnidade]);

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
            Despachos, ofícios e relatórios guardados do assistente, classificados por órgão e tipo
            de unidade, com histórico de versões.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Procurar por título, etiqueta ou texto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Procurar modelos"
          />
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os tipos</SelectItem>
              {TIPOS_MODELO.map(([chave, rotulo]) => (
                <SelectItem key={chave} value={chave}>
                  {rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={orgao} onValueChange={setOrgao}>
            <SelectTrigger aria-label="Filtrar por órgão">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os órgãos</SelectItem>
              {ORGAO_VALUES.map((o) => (
                <SelectItem key={o} value={o}>
                  {orgaoLabel(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipoUnidade} onValueChange={setTipoUnidade}>
            <SelectTrigger aria-label="Filtrar por tipo de unidade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as unidades</SelectItem>
              {TIPOS_UNIDADE_MODELO.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_UNIDADE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
          {!isLoading && lista.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum modelo corresponde a estes filtros. Use “Guardar como modelo” numa resposta do
              assistente.
            </p>
          )}
          {lista.map((m) => (
            <article key={m.id} className="rounded-lg border p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate text-sm font-semibold">{m.titulo}</h3>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {m.tipo}
                    </Badge>
                    {m.orgao && (
                      <Badge variant="outline" className="text-[10px]">
                        {orgaoLabel(m.orgao)}
                      </Badge>
                    )}
                    {m.tipo_unidade && (
                      <Badge variant="outline" className="text-[10px]">
                        {TIPO_UNIDADE_LABEL[m.tipo_unidade] ?? m.tipo_unidade}
                      </Badge>
                    )}
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
                  <VersoesModelo id={m.id} versao={m.versao ?? 1} />
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
