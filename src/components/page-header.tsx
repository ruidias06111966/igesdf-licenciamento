import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import logoIgesdf from "@/assets/igesdf-logo.jpg.asset.json";

export type Migalha = { label: string; to?: string };

type Props = {
  titulo: string;
  descricao?: ReactNode;
  /** Botões de ação. Escondidos na impressão. */
  acoes?: ReactNode;
  migalhas?: Migalha[];
};

/**
 * Cabeçalho padrão das páginas: mesma tipografia, mesmo espaçamento e mesmo
 * comportamento responsivo em todo o sistema (as ações descem para baixo do
 * título em telas estreitas em vez de comprimirem o texto).
 */
export function PageHeader({ titulo, descricao, acoes, migalhas }: Props) {
  return (
    <header className="space-y-3">
      {/* Cabeçalho institucional: só aparece no papel / PDF. */}
      <div className="print-only mb-3 hidden items-center gap-3 border-b pb-2">
        <img
          src={logoIgesdf.url}
          alt="IGESDF"
          className="h-10 w-auto"
          style={{ height: "12mm", width: "auto" }}
        />
        <span className="text-xs tracking-widest uppercase">
          Instituto de Gestão Estratégica de Saúde do Distrito Federal — Licenciamento
        </span>
      </div>
      {migalhas && migalhas.length > 0 && (
        <nav aria-label="Navegação estrutural" className="no-print">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {migalhas.map((m, i) => (
              <li key={`${m.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3 shrink-0" aria-hidden="true" />}
                {m.to ? (
                  <Link to={m.to} className="rounded hover:text-foreground hover:underline">
                    {m.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {m.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
          {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2 no-print">{acoes}</div>}
      </div>
    </header>
  );
}
