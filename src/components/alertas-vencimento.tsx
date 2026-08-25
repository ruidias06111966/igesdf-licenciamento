import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { licencasQuery } from "@/lib/queries";
import { formatDate, formatDaysLeft } from "@/lib/dates";
import { orgaoLabel } from "@/lib/domain";
import type { LicencaDashboard } from "@/lib/rows";

/** Janela de aviso: 90 dias é o prazo mínimo para instruir uma renovação. */
export const JANELA_ALERTA_DIAS = 90;

export function licencasEmAlerta(licencas: LicencaDashboard[]): LicencaDashboard[] {
  return licencas
    .filter((l) => {
      if (!l.data_vencimento || l.dias_restantes === null) return false;
      if (l.status === "dispensada" || l.status === "indeferida") return false;
      return l.dias_restantes <= JANELA_ALERTA_DIAS;
    })
    .sort((a, b) => (a.dias_restantes ?? 0) - (b.dias_restantes ?? 0));
}

/**
 * Sino de alertas: licenças vencidas ou a menos de 90 dias do vencimento.
 *
 * Fica no cabeçalho porque o aviso tem de aparecer em qualquer ecrã — quem
 * está a tratar de um processo não vai ao painel verificar prazos.
 */
export function AlertasVencimento() {
  const [aberto, setAberto] = useState(false);
  const { data } = useQuery(licencasQuery);

  const alertas = useMemo(() => licencasEmAlerta(data ?? []), [data]);
  const vencidas = alertas.filter((l) => (l.dias_restantes ?? 0) < 0).length;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-sidebar-foreground hover:bg-sidebar-accent/60"
          aria-label={`Alertas de vencimento (${alertas.length})`}
        >
          <Bell className="size-5" aria-hidden="true" />
          {alertas.length > 0 && (
            <span
              className={`absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold ${
                vencidas > 0
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {alertas.length > 99 ? "99+" : alertas.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,26rem)] p-0">
        <div className="border-b p-3">
          <p className="text-sm font-semibold">Próximos vencimentos</p>
          <p className="text-xs text-muted-foreground">
            Licenças vencidas ou a expirar nos próximos {JANELA_ALERTA_DIAS} dias.
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {alertas.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Nenhuma licença em risco nesta janela.
            </p>
          )}
          <ul className="divide-y">
            {alertas.slice(0, 40).map((l) => (
              <li key={l.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.unidade_nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {orgaoLabel(l.orgao)} · {l.descricao ?? "Sem descrição"}
                    </p>
                  </div>
                  <Badge
                    variant={(l.dias_restantes ?? 0) < 0 ? "destructive" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {formatDaysLeft(l.dias_restantes)}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Vence em {formatDate(l.data_vencimento)}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/calendario" onClick={() => setAberto(false)}>
              Ver todos os vencimentos
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
