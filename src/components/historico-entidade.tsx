import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/states";
import { listAuditoria, type RegistoAuditoria } from "@/lib/auditoria.functions";
import {
  ACAO_LABEL,
  campoLegivel,
  dataHora,
  PERFIL_LABEL,
  valorLegivel,
} from "@/lib/auditoria-labels";

/** Linha do tempo de um registo: quem mexeu, quando e o que mudou. */
export function ListaHistorico({ registos }: { registos: RegistoAuditoria[] }) {
  if (registos.length === 0) {
    return (
      <EmptyState
        compacto
        titulo="Sem alterações registadas"
        descricao="O histórico começa a ser gravado a partir da próxima edição."
        icone={<History className="size-5" aria-hidden="true" />}
      />
    );
  }
  return (
    <ol className="space-y-3">
      {registos.map((r) => (
        <li key={r.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={r.acao === "excluir" ? "destructive" : "secondary"} className="text-[10px]">
              {ACAO_LABEL[r.acao] ?? r.acao}
            </Badge>
            <span className="text-xs text-muted-foreground">{dataHora(r.created_at)}</span>
            {r.perfil && (
              <Badge variant="outline" className="text-[10px]">
                Perfil {PERFIL_LABEL[r.perfil] ?? r.perfil}
              </Badge>
            )}
          </div>
          {r.alteracoes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {r.alteracoes.map((a, i) => (
                <li key={`${a.campo}-${i}`} className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <span className="font-medium">{campoLegivel(a.campo)}</span>
                  <span className="text-muted-foreground">
                    <span className="line-through">{valorLegivel(a.campo, a.antes)}</span>
                    <span aria-hidden="true"> → </span>
                    <span className="text-foreground">{valorLegivel(a.campo, a.depois)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {r.alteracoes.length === 0 && r.detalhes && (
            <p className="mt-1 text-xs text-muted-foreground">
              {Object.entries(r.detalhes)
                .filter(([, v]) => v !== null && v !== "")
                .map(([k, v]) => `${campoLegivel(k)}: ${valorLegivel(k, v)}`)
                .join(" · ") || "Sem detalhes adicionais."}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Botão de histórico para colocar ao lado de cada registo (licença, unidade,
 * processo). Só consulta a auditoria quando o diálogo é aberto.
 */
export function HistoricoEntidade({
  entidade,
  entidadeId,
  titulo,
}: {
  entidade: string;
  entidadeId: string;
  titulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["auditoria", entidade, entidadeId],
    queryFn: () => listAuditoria({ data: { entidade, entidade_id: entidadeId, limite: 100 } }),
    enabled: aberto,
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Ver histórico de alterações">
          <History className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de alterações</DialogTitle>
          <DialogDescription className="text-xs">
            {titulo ?? "Registo de quem alterou, quando e que campos mudaram."}
          </DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
        {error && <ErrorState error={error} />}
        {data && <ListaHistorico registos={data} />}
      </DialogContent>
    </Dialog>
  );
}
