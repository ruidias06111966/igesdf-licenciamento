import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import type { Ordenacao } from "@/lib/use-ordenacao";
import { cn } from "@/lib/utils";

/**
 * Envolve a tabela num contêiner com rolagem horizontal própria. Sem isto as
 * tabelas largas empurravam a página inteira para o lado em telas estreitas.
 */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto print:overflow-visible", className)}>{children}</div>
  );
}

/** Cabeçalho clicável de coluna ordenável, com o estado anunciado a leitores de tela. */
export function SortableTh<K extends string>({
  chave,
  ordem,
  alternar,
  children,
  className,
  alinhamento = "left",
}: {
  chave: K;
  ordem: Ordenacao<K>;
  alternar: (chave: K) => void;
  children: ReactNode;
  className?: string;
  alinhamento?: "left" | "right" | "center";
}) {
  const ativa = ordem.chave === chave;
  const Icone = !ativa ? ChevronsUpDown : ordem.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn("p-3 font-medium", className)}
      aria-sort={ativa ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => alternar(chave)}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          ativa && "text-foreground",
          alinhamento === "right" && "flex-row-reverse",
        )}
      >
        {children}
        <Icone className="size-3 shrink-0 no-print" aria-hidden="true" />
      </button>
    </th>
  );
}
