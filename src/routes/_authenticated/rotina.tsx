import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { ListaHistorico } from "@/components/historico-entidade";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  executarSincronizacao,
  getConfigRotina,
  salvarConfigRotina,
} from "@/lib/rotina.functions";
import { listAuditoria } from "@/lib/auditoria.functions";
import { dataHora } from "@/lib/auditoria-labels";
import { invalidarDados } from "@/lib/queries";
import { mensagemErro } from "@/lib/errors";
import { usePodeEditar } from "@/lib/perfil";

export const Route = createFileRoute("/_authenticated/rotina")({
  head: () => ({
    meta: [
      { title: "Correção automática — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Configure o horário e o fuso da correção automática diária das licenças vencidas e execute a rotina manualmente em lote.",
      },
      { property: "og:title", content: "Correção automática de licenças — IGESDF" },
      {
        property: "og:description",
        content: "Horário, fuso e execução manual da rotina que marca licenças vencidas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RotinaPage,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

const FUSOS = [
  { valor: "America/Sao_Paulo", label: "Brasília (America/Sao_Paulo)" },
  { valor: "America/Manaus", label: "Manaus (America/Manaus)" },
  { valor: "America/Belem", label: "Belém (America/Belem)" },
  { valor: "America/Rio_Branco", label: "Rio Branco (America/Rio_Branco)" },
  { valor: "UTC", label: "UTC" },
];

function RotinaPage() {
  const qc = useQueryClient();
  const podeEditar = usePodeEditar();
  const { data, isLoading, error } = useQuery({
    queryKey: ["config-rotina"],
    queryFn: () => getConfigRotina(),
  });

  const [hora, setHora] = useState("00:10");
  const [fuso, setFuso] = useState("America/Sao_Paulo");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!data) return;
    setHora(`${String(data.hora).padStart(2, "0")}:${String(data.minuto).padStart(2, "0")}`);
    setFuso(data.fuso);
    setAtivo(data.ativo);
  }, [data]);

  const historico = useQuery({
    queryKey: ["auditoria", "sincronizacao"],
    queryFn: () => listAuditoria({ data: { acao: "sincronizar", limite: 50 } }),
  });

  const guardar = useMutation({
    mutationFn: () => {
      const [h, m] = hora.split(":");
      return salvarConfigRotina({
        data: { hora: Number(h ?? 0), minuto: Number(m ?? 0), fuso, ativo },
      });
    },
    onSuccess: (r) => {
      toast.success(
        ativo
          ? `Horário gravado. Agendamento em UTC: ${r.expressao ?? "—"}.`
          : "Correção automática desativada.",
      );
      void qc.invalidateQueries({ queryKey: ["config-rotina"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const executar = useMutation({
    mutationFn: () => executarSincronizacao(),
    onSuccess: (r) => {
      toast.success(
        r.atualizadas > 0
          ? `${r.atualizadas} licença(s) passaram a constar como vencidas.`
          : "Nenhuma licença estava por corrigir.",
      );
      invalidarDados(qc);
      void historico.refetch();
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        titulo="Correção automática"
        descricao="Todos os dias o sistema marca como vencida qualquer licença cujo prazo tenha passado. Aqui define quando isso acontece e pode reprocessar em lote."
        migalhas={[{ label: "Início", to: "/dashboard" }, { label: "Correção automática" }]}
      />

      {isLoading && <p className="text-sm text-muted-foreground">A carregar configuração…</p>}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4" aria-hidden="true" /> Horário da rotina diária
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="hora-rotina">Hora local</Label>
                  <Input
                    id="hora-rotina"
                    type="time"
                    value={hora}
                    disabled={!podeEditar}
                    onChange={(e) => setHora(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fuso-rotina">Fuso horário</Label>
                  <Select value={fuso} onValueChange={setFuso} disabled={!podeEditar}>
                    <SelectTrigger id="fuso-rotina">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUSOS.map((f) => (
                        <SelectItem key={f.valor} value={f.valor}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Correção automática ativa</p>
                  <p className="text-xs text-muted-foreground">
                    Desligue apenas se quiser corrigir sempre à mão.
                  </p>
                </div>
                <Switch checked={ativo} onCheckedChange={setAtivo} disabled={!podeEditar} />
              </div>

              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>
                  Última execução:{" "}
                  <span className="text-foreground">
                    {data.ultima_execucao ? dataHora(data.ultima_execucao) : "ainda não correu"}
                  </span>
                </p>
                <p>
                  Licenças corrigidas na última execução:{" "}
                  <span className="text-foreground">{data.ultimo_total ?? 0}</span>
                </p>
              </div>

              {podeEditar && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                    {guardar.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Guardar horário
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => executar.mutate()}
                    disabled={executar.isPending}
                  >
                    {executar.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="size-4" aria-hidden="true" />
                    )}
                    Executar agora (lote)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas correções registadas</CardTitle>
            </CardHeader>
            <CardContent>
              {historico.isLoading && (
                <p className="text-sm text-muted-foreground">A carregar histórico…</p>
              )}
              {historico.data && <ListaHistorico registos={historico.data} />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
