import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calcularSemaforo, semaforoColor, type Semaforo } from "@/lib/domain";

/**
 * Etiqueta de semáforo. Aceita o semáforo já calculado pela view do painel ou
 * calcula-o a partir de status + vencimento, sempre com a mesma regra — antes
 * cada página tinha a sua própria cópia do cálculo e elas divergiam.
 */
export function SemaforoBadge({
  semaforo,
  licenca,
  className,
}: {
  semaforo?: Semaforo | null;
  licenca?: { status: string | null; data_vencimento: string | null };
  className?: string;
}) {
  const valor = semaforo ?? (licenca ? calcularSemaforo(licenca) : "sem_data");
  const tom = semaforoColor(valor);
  return (
    <Badge className={cn("gap-1.5 border-0 font-medium", tom.bg, tom.text, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", tom.dot)} aria-hidden="true" />
      {tom.label}
    </Badge>
  );
}
