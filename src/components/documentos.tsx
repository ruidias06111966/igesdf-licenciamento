import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileText, History, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, formatDate, formatDateTime, daysUntil } from "@/lib/dates";
import { mensagemErro } from "@/lib/errors";
import {
  deleteDocumento,
  enviarArquivo,
  listVersoesDocumento,
  registrarDocumento,
  registrarNovaVersao,
  setVersaoVigente,
  signedDocUrl,
} from "@/lib/licencas.functions";
import { chaves, invalidarDados } from "@/lib/queries";
import type { Documento } from "@/lib/rows";
import { cn } from "@/lib/utils";

/** Envia o arquivo pelo servidor e devolve os metadados para registro. */
async function subir(arquivo: File, prefixo: string) {
  const formulario = new FormData();
  formulario.append("arquivo", arquivo);
  formulario.append("prefixo", prefixo);
  return enviarArquivo({ data: formulario });
}

async function abrirDocumento(caminho: string) {
  try {
    const { url } = await signedDocUrl({ data: { path: caminho } });
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (erro) {
    toast.error(mensagemErro(erro));
  }
}

/** Botão de anexar arquivo, para a unidade ou para uma licença específica. */
export function UploadDoc({
  unidadeId,
  licencaId,
  processoId,
  processoItemId,
  rotulo = "Anexar",
}: {
  unidadeId: string;
  licencaId?: string;
  processoId?: string;
  processoItemId?: string;
  rotulo?: string;
}) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);

  async function enviar(arquivo: File) {
    setOcupado(true);
    try {
      const prefixo = processoId
        ? `${unidadeId}/processos/${processoId}`
        : `${unidadeId}/${licencaId ?? "geral"}`;
      const enviado = await subir(arquivo, prefixo);
      await registrarDocumento({
        data: {
          ...enviado,
          unidade_id: unidadeId,
          licenca_id: licencaId ?? null,
          processo_id: processoId ?? null,
          processo_item_id: processoItemId ?? null,
          categoria: processoId ? "processo" : licencaId ? "licenca" : "unidade",
        },
      });
      toast.success("Documento anexado");
      invalidarDados(qc);
    } catch (erro) {
      toast.error(mensagemErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Button asChild size="sm" variant="outline" disabled={ocupado}>
      <label className="cursor-pointer">
        <input
          type="file"
          className="sr-only"
          disabled={ocupado}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.currentTarget.value = "";
            if (arquivo) void enviar(arquivo);
          }}
        />
        <Upload className="mr-1 size-4" aria-hidden="true" /> {ocupado ? "Enviando…" : rotulo}
      </label>
    </Button>
  );
}

/** Cor da etiqueta de validade: vermelho se vencida, âmbar até 90 dias. */
function toneValidade(dataValidade: string | null): string {
  const dias = daysUntil(dataValidade);
  if (dias === null) return "";
  if (dias < 0) return "bg-destructive/15 text-destructive";
  if (dias <= 90) return "bg-warning/20 text-warning-foreground";
  return "bg-success/15 text-success";
}

export function DocRow({
  documento,
  unidadeId,
  onChange,
}: {
  documento: Documento;
  unidadeId?: string;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">{documento.nome}</span>
          <Badge variant="secondary" className="text-[10px]">
            v{documento.versao}
          </Badge>
          {documento.ativo && (
            <Badge className="border-0 bg-success/15 text-[10px] text-success">vigente</Badge>
          )}
          {documento.data_validade && (
            <Badge className={cn("border-0 text-[10px]", toneValidade(documento.data_validade))}>
              Validade {formatDate(documento.data_validade)}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {documento.mime_type ?? "arquivo"} · {formatBytes(documento.tamanho_bytes)} · enviado em{" "}
          {formatDateTime(documento.created_at)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {unidadeId && (
          <NovaVersaoBtn documentoId={documento.id} unidadeId={unidadeId} onChange={onChange} />
        )}
        <HistoricoBtn documentoId={documento.id} onChange={onChange} />
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Baixar ${documento.nome}`}
          title="Baixar"
          onClick={() => void abrirDocumento(documento.storage_path)}
        >
          <Download className="size-4" aria-hidden="true" />
        </Button>
        <ConfirmDelete
          titulo="Excluir documento"
          descricao="O arquivo é removido do armazenamento e não pode ser recuperado."
          mensagemSucesso="Documento excluído"
          onConfirm={() =>
            deleteDocumento({ data: { id: documento.id, storage_path: documento.storage_path } })
          }
          onDone={onChange}
        />
      </div>
    </div>
  );
}

/** Sobe uma nova versão do documento, arquivando as anteriores. */
function NovaVersaoBtn({
  documentoId,
  unidadeId,
  onChange,
}: {
  documentoId: string;
  unidadeId: string;
  onChange: () => void;
}) {
  const [pendente, setPendente] = useState<File | null>(null);
  const [validade, setValidade] = useState("");
  const [comentario, setComentario] = useState("");
  const [ocupado, setOcupado] = useState(false);

  function limpar() {
    setPendente(null);
    setValidade("");
    setComentario("");
  }

  async function enviar() {
    if (!pendente) return;
    setOcupado(true);
    try {
      const enviado = await subir(pendente, `${unidadeId}/versoes/${documentoId}`);
      await registrarNovaVersao({
        data: {
          documento_pai_id: documentoId,
          storage_path: enviado.storage_path,
          mime_type: enviado.mime_type,
          tamanho_bytes: enviado.tamanho_bytes,
          data_validade: validade || null,
          comentario_versao: comentario || null,
        },
      });
      toast.success("Nova versão registrada");
      limpar();
      onChange();
    } catch (erro) {
      toast.error(mensagemErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Button asChild size="icon" variant="ghost" disabled={ocupado}>
        <label className="cursor-pointer" title="Enviar nova versão">
          <span className="sr-only">Enviar nova versão</span>
          <input
            type="file"
            className="sr-only"
            disabled={ocupado}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.currentTarget.value = "";
              if (arquivo) setPendente(arquivo);
            }}
          />
          <Upload className="size-4" aria-hidden="true" />
        </label>
      </Button>
      <Sheet
        open={Boolean(pendente)}
        onOpenChange={(aberto) => {
          if (!aberto) limpar();
        }}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="pr-12">
            <SheetTitle>Nova versão</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <p className="truncate text-xs text-muted-foreground" title={pendente?.name}>
              Arquivo: {pendente?.name}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="versao-validade" className="text-xs">
                Data de validade do documento
              </Label>
              <Input
                id="versao-validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="versao-comentario" className="text-xs">
                Comentário da versão
              </Label>
              <Textarea
                id="versao-comentario"
                rows={3}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Ex.: renovação anual, ajuste de razão social…"
              />
            </div>
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Ao salvar, esta versão passa a ser a <strong>vigente</strong> e as anteriores ficam
              arquivadas no histórico.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={limpar}>
                Cancelar
              </Button>
              <Button disabled={ocupado} onClick={() => void enviar()}>
                {ocupado ? "Enviando…" : "Salvar versão"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Histórico de versões, com opção de reverter para uma versão anterior. */
function HistoricoBtn({ documentoId, onChange }: { documentoId: string; onChange: () => void }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const { data: versoes, isLoading } = useQuery({
    queryKey: chaves.versoes(documentoId),
    queryFn: () => listVersoesDocumento({ data: { documento_id: documentoId } }),
    enabled: aberto,
  });
  const marcar = useMutation({
    mutationFn: (id: string) => setVersaoVigente({ data: { id } }),
    onSuccess: () => {
      toast.success("Versão marcada como vigente");
      void qc.invalidateQueries({ queryKey: chaves.versoes(documentoId) });
      onChange();
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Histórico de versões" title="Histórico">
          <History className="size-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader className="pr-12">
          <SheetTitle>Histórico de versões</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 pt-4">
          {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
          {(versoes ?? []).map((v) => (
            <div key={v.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  v{v.versao}
                  {v.ativo && (
                    <Badge className="border-0 bg-success/15 text-[10px] text-success">
                      vigente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!v.ativo && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={marcar.isPending}
                      onClick={() => marcar.mutate(v.id)}
                    >
                      <CheckCircle2 className="mr-1 size-4" aria-hidden="true" /> Tornar vigente
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Baixar versão ${v.versao}`}
                    onClick={() => void abrirDocumento(v.storage_path)}
                  >
                    <Download className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(v.created_at)}
                {v.data_validade ? ` · validade ${formatDate(v.data_validade)}` : ""}
              </div>
              {v.comentario_versao && <p className="mt-1 text-xs">{v.comentario_versao}</p>}
            </div>
          ))}
          {!isLoading && (versoes ?? []).length === 0 && (
            <EmptyState compacto titulo="Sem versões anteriores" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Gaveta com os documentos anexados a uma licença. */
export function DocsLicenca({
  licencaId,
  unidadeId,
  documentos,
  onChange,
}: {
  licencaId: string;
  unidadeId: string;
  documentos: Documento[];
  onChange: () => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Documentos da licença (${documentos.length})`}
          title={`Documentos (${documentos.length})`}
          className="relative"
        >
          <FileText className="size-4" aria-hidden="true" />
          {documentos.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
              {documentos.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader className="pr-12">
          <SheetTitle>Documentos da licença</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 pt-4">
          <UploadDoc unidadeId={unidadeId} licencaId={licencaId} />
          {documentos.map((d) => (
            <DocRow key={d.id} documento={d} unidadeId={unidadeId} onChange={onChange} />
          ))}
          {documentos.length === 0 && (
            <EmptyState
              compacto
              titulo="Nenhum documento anexado"
              descricao="Anexe o certificado, projeto aprovado ou laudo que sustenta esta licença."
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
