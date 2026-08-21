import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { baixarCsv, type ColunaCsv } from "@/lib/csv";
import { baixarPlanilha } from "@/lib/exportar/planilha";
import { mensagemErro } from "@/lib/errors";

/**
 * Botão único de exportação de tabelas. O Excel sai formatado (faixa de
 * título, cabeçalho institucional, filtros, zebra e situações a cores); o CSV
 * fica para quem precisa do dado cru para outro sistema.
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
}: {
  nomeArquivo: string;
  titulo: string;
  subtitulo?: string;
  folha?: string;
  linhas: T[];
  colunas: ColunaCsv<T>[];
  rotulo?: string;
  variant?: "outline" | "secondary" | "default";
}) {
  const vazio = linhas.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} disabled={vazio} className="no-print">
          <Download className="mr-1 size-4" aria-hidden="true" /> {rotulo}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem
          onSelect={() => {
            void baixarPlanilha(nomeArquivo, linhas, colunas, { titulo, subtitulo, folha }).catch(
              (e) => toast.error(mensagemErro(e)),
            );
          }}
        >
          <FileSpreadsheet className="mr-2 size-4" aria-hidden="true" />
          <span className="flex flex-col">
            <span>Excel (.xlsx)</span>
            <span className="text-[11px] text-muted-foreground">
              Formatado, com cores por situação e filtros.
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            baixarCsv(nomeArquivo, linhas, colunas);
          }}
        >
          <FileText className="mr-2 size-4" aria-hidden="true" />
          <span className="flex flex-col">
            <span>CSV</span>
            <span className="text-[11px] text-muted-foreground">
              Dados simples para importar noutro sistema.
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
