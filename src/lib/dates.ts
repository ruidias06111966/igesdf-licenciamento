/**
 * Datas de licenciamento são sempre datas de calendário (`DATE` no Postgres),
 * nunca instantes. `new Date("2026-07-30")` é interpretado como meia-noite UTC,
 * o que em Brasília (UTC-3) cai no dia anterior — e fazia a mesma licença
 * aparecer como "Vigente" numa página e "Crítico" noutra.
 *
 * Todo o cálculo aqui é feito no calendário local, para bater exatamente com o
 * `CURRENT_DATE` usado pela view `v_licencas_dashboard`.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Converte "AAAA-MM-DD" (ou timestamp ISO) numa data local à meia-noite. */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hoje, à meia-noite local. */
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Data local à meia-noite formatada como "AAAA-MM-DD". */
export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Dias inteiros de hoje até à data indicada. Negativo = já passou. */
export function daysUntil(iso: string | null | undefined): number | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  return Math.round((d.getTime() - today().getTime()) / 86_400_000);
}

/** "AAAA-MM-DD" → "DD/MM/AAAA". */
export function formatDate(iso: string | null | undefined): string {
  const d = parseIsoDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

/** Timestamp ISO → "DD/MM/AAAA, HH:MM". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** "AAAA-MM" → "julho de 2026". */
export function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

/** Contagem de dias em texto: "em 45 dias", "vencida há 3 dias", "vence hoje". */
export function formatDaysLeft(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return "—";
  if (dias === 0) return "vence hoje";
  if (dias > 0) return `em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const atraso = Math.abs(dias);
  return `há ${atraso} ${atraso === 1 ? "dia" : "dias"}`;
}

/** Soma dias a uma data de calendário. */
export function addDays(d: Date, dias: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
}

/** Tamanho de ficheiro legível. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
