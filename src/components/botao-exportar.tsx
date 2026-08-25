import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, FileType2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { baixarCsv, type ColunaCsv } from "@/lib/csv";
import { baixarPlanilha } from "@/lib/exportar/planilha";
import { exportarDocumento } from "@/lib/exportar-documento";
import {
  construirHtmlRelatorio,
  construirMarkdownRelatorio,
  type Orientacao,
} from "@/lib/exportar/folha-html";
import { competenciaAtual, nomePadronizado, type MetaExport } from "@/lib/exportar/metadados";
import { mensagemErro } from "@/lib/errors";

/**
 * Botão único de exportação de tabelas.
 *
 * Abre uma pré-visualização A4 fiel (capa institucional, legenda do semáforo,
 * margens, quebras de página e cores) onde o utilizador confirma os metadados
 * de arquivo no SEI antes de gerar o Excel, o Word, o PDF ou o CSV.
 */
export function BotaoExportar<T>({
  nomeArquivo,
  titulo,
  subtitulo,
  folha,
  linhas,
  colunas,
  rotulo = "Exportar",
  variant = "outline",
  modulo,
  meta: metaInicial,
}: {
  nomeArquivo: string;
  titulo: string;
  subtitulo?: string;
  folha?: string;
  linhas: T[];
  colunas: ColunaCsv<T>[];
  rotulo?: string;
  variant?: "outline" | "secondary" | "default";
  /** Nome curto do módulo usado no ficheiro (ex.: "Licencas"). */
  modulo?: string;
  /** Metadados iniciais sugeridos pela página. */
  meta?: MetaExport;
}) {
  const vazio = linhas.length === 0;
  const [aberto, setAberto] = useState(false);
  const [orientacao, setOrientacao] = useState<Orientacao>("landscape");
  const [meta, setMeta] = useState<MetaExport>({
    competencia: metaInicial?.competencia ?? competenciaAtual(),
    unidade: metaInicial?.unidade ?? "",
    orgao: metaInicial?.orgao ?? "",
    processo: metaInicial?.processo ?? "",
    protocolo: metaInicial?.protocolo ?? "",
  });

  const metaLimpa = useMemo<MetaExport>(
    () => ({
      competencia: meta.competencia?.trim() || undefined,
      unidade: meta.unidade?.trim() || undefined,
      orgao: meta.orgao?.trim() || undefined,
      processo: meta.processo?.trim() || undefined,
      protocolo: meta.protocolo?.trim() || undefined,
    }),
    [meta],
  );

  const doc = useMemo(
    () => ({
      titulo,
      subtitulo,
      meta: metaLimpa,
      colunas: colunas.map((c) => ({ cabecalho: c.cabecalho, situacao: c.situacao })),
      linhas: linhas.map((l) =>
        colunas.map((c) => {
          const v = c.valor(l);
          return v === null || v === undefined ? "" : String(v);
        }),
      ),
      orientacao,
    }),
    [titulo, subtitulo, metaLimpa, colunas, linhas, orientacao],
  );

  const base = modulo ?? folha ?? nomeArquivo;
  const nome = (ext: string) => nomePadronizado(base, metaLimpa, ext);

  const html = useMemo(() => (aberto ? construirHtmlRelatorio(doc) : ""), [aberto, doc]);

  function imprimir() {
    const janela = window.open("", "_blank", "width=1100,height=900");
    if (!janela) {
      toast.error("O navegador bloqueou a janela de impressão.");
      return;
    }
    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 500);
  }

  async function exportarExcel() {
    await baixarPlanilha(nome("xlsx"), linhas, colunas, {
      titulo,
      subtitulo,
      folha,
      meta: metaLimpa,
    });
  }

  async function exportarWord() {
    await exportarDocumento("docx", titulo, construirMarkdownRelatorio(doc));
  }

  const campo = (id: keyof MetaExport, rotuloCampo: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`meta-${id}`} className="text-xs text-muted-foreground">
        {rotuloCampo}
      </Label>
      <Input
        id={`meta-${id}`}
        value={(meta[id] as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => setMeta((m) => ({ ...m, [id]: e.target.value }))}
      />
    </div>
  );

  return (
    <>
      <Button
        variant={variant}
        disabled={vazio}
        className="no-print"
        onClick={() => setAberto(true)}
      >
        <Download className="mr-1 size-4" aria-hidden="true" /> {rotulo}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Pré-visualizar exportação</DialogTitle>
            <DialogDescription>
              Confira margens, quebras de página e cores antes de confirmar. Os metadados abaixo
              entram na capa, no nome do ficheiro e nas propriedades do documento.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {campo("competencia", "Competência", "2026-08")}
            {campo("unidade", "Unidade", "Rede IGESDF")}
            {campo("orgao", "Órgão", "Todos")}
            {campo("processo", "Processo SEI", "00060-00000000/2026-00")}
            {campo("protocolo", "Protocolo/documento", "SEI nº 000000")}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Orientação</Label>
              <Select value={orientacao} onValueChange={(v) => setOrientacao(v as Orientacao)}>
                <SelectTrigger aria-label="Orientação da página">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">A4 horizontal</SelectItem>
                  <SelectItem value="portrait">A4 vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted">
            <iframe
              title="Pré-visualização da exportação"
              srcDoc={html}
              className="h-[60vh] w-full bg-background"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Ficheiro: <span className="font-mono">{nome("xlsx")}</span>
          </p>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => baixarCsv(nome("csv"), linhas, colunas)}>
              <FileText className="mr-1 size-4" aria-hidden="true" /> CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void exportarWord().catch((e) => toast.error(mensagemErro(e)));
              }}
            >
              <FileType2 className="mr-1 size-4" aria-hidden="true" /> Word
            </Button>
            <Button variant="outline" onClick={imprimir}>
              <Printer className="mr-1 size-4" aria-hidden="true" /> PDF / imprimir
            </Button>
            <Button
              onClick={() => {
                void exportarExcel().catch((e) => toast.error(mensagemErro(e)));
              }}
            >
              <FileSpreadsheet className="mr-1 size-4" aria-hidden="true" /> Excel (.xlsx)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
