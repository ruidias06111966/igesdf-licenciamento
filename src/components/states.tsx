import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { descreverErro } from "@/lib/errors";
import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vazio com chamada para ação, em vez de uma linha de texto solta. */
export function EmptyState({
  titulo,
  descricao,
  acao,
  icone,
  compacto,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  icone?: ReactNode;
  compacto?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-center ${
        compacto ? "py-6" : "py-12"
      }`}
    >
      <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icone ?? <Inbox className="size-5" aria-hidden="true" />}
      </div>
      <p className="font-medium">{titulo}</p>
      {descricao && <p className="max-w-md text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

/**
 * Painel de erro das rotas. Mostra a causa traduzida e um botão de nova
 * tentativa, em vez de despejar `error.message` cru na página.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { titulo, detalhe, podeTentarNovamente } = descreverErro(error);
  return (
    <div className="p-6 sm:p-8">
      <Card className="mx-auto max-w-lg border-destructive/30">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold">{titulo}</h2>
            <p className="text-sm text-muted-foreground">{detalhe}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {podeTentarNovamente && onRetry && (
              <Button onClick={onRetry} size="sm">
                <RotateCcw className="mr-1 size-4" aria-hidden="true" /> Tentar novamente
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <a href="/dashboard">Ir para o painel</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Esqueleto de tabela usado como `pendingComponent` das rotas com listagem. */
export function TableSkeleton({ linhas = 6, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-3">
          {Array.from({ length: colunas }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: linhas }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: colunas }).map((_, c) => (
              <Skeleton key={c} className="h-8 flex-1" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Esqueleto de página completa: cabeçalho, filtros e conteúdo. */
export function PageSkeleton({
  cartoes = 0,
  linhas = 6,
  colunas = 5,
}: {
  cartoes?: number;
  linhas?: number;
  colunas?: number;
}) {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      {cartoes > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: cartoes }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      <TableSkeleton linhas={linhas} colunas={colunas} />
    </div>
  );
}

/** Esqueleto para páginas em grade de cartões. */
export function CardGridSkeleton({ itens = 6 }: { itens?: number }) {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 max-w-md" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: itens }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
