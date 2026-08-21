import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { ListaHistorico } from "@/components/historico-entidade";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAuditoria } from "@/lib/auditoria.functions";
import {
  ACAO_LABEL,
  campoLegivel,
  dataHora,
  ENTIDADE_LABEL,
  PERFIL_LABEL,
  valorLegivel,
} from "@/lib/auditoria-labels";
import { sufixoData, type ColunaCsv } from "@/lib/csv";
import { BotaoExportar } from "@/components/botao-exportar";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — IGESDF Licenciamento" },
      {
        name: "description",
        content:
          "Histórico de alterações das licenças, documentos e despachos: data, perfil e campos alterados.",
      },
      { property: "og:title", content: "Auditoria — IGESDF Licenciamento" },
      {
        property: "og:description",
        content: "Registo completo das alterações feitas no controlo de licenciamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auditoria,
  errorComponent: ({ error }) => <ErrorState error={error} />,
});

const TODOS = "__todos__";

function Auditoria() {
  const [entidade, setEntidade] = useState<string>(TODOS);
  const [acao, setAcao] = useState<string>(TODOS);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const filtros = useMemo(
    () => ({
      ...(entidade !== TODOS ? { entidade } : {}),
      ...(acao !== TODOS ? { acao } : {}),
      ...(de ? { de } : {}),
      ...(ate ? { ate } : {}),
      limite: 500,
    }),
    [entidade, acao, de, ate],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["auditoria", filtros],
    queryFn: () => listAuditoria({ data: filtros }),
  });

  const registos = data ?? [];

  const colunasExport: ColunaCsv<(typeof registos)[number]>[] = [
        { cabecalho: "Data", valor: (r) => dataHora(r.created_at) },
        { cabecalho: "Área", valor: (r) => ENTIDADE_LABEL[r.entidade] ?? r.entidade },
        { cabecalho: "Ação", valor: (r) => ACAO_LABEL[r.acao] ?? r.acao },
        { cabecalho: "Perfil", valor: (r) => (r.perfil ? (PERFIL_LABEL[r.perfil] ?? r.perfil) : "—") },
        {
          cabecalho: "Alterações",
          valor: (r) =>
            r.alteracoes
              .map(
                (a) =>
                  `${campoLegivel(a.campo)}: ${valorLegivel(a.campo, a.antes)} → ${valorLegivel(a.campo, a.depois)}`,
              )
              .join(" | "),
        },
        {
          cabecalho: "Contexto",
          valor: (r) =>
            r.detalhes
              ? Object.entries(r.detalhes)
                  .filter(([, v]) => v !== null && v !== "")
                  .map(([k, v]) => `${campoLegivel(k)}: ${valorLegivel(k, v)}`)
                  .join(" | ")
              : "",
        },
      ],
    );

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        titulo="Auditoria"
        descricao="Quem alterou, quando e o que mudou nas licenças, documentos e despachos."
        migalhas={[{ label: "Início", to: "/dashboard" }, { label: "Auditoria" }]}
        acoes={
          <>
            <BotaoExportar
              nomeArquivo={`auditoria-${sufixoData()}`}
              titulo="IGESDF — Registo de auditoria"
              subtitulo={`${registos.length} evento(s)`}
              folha="Auditoria"
              linhas={registos}
              colunas={colunasExport}
            />
            <PrintModeToggle />
          </>
        }
      />

      <Card className="no-print">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-medium">
            Área
            <Select value={entidade} onValueChange={setEntidade}>
              <SelectTrigger aria-label="Filtrar por área">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as áreas</SelectItem>
                {Object.entries(ENTIDADE_LABEL).map(([chave, rotulo]) => (
                  <SelectItem key={chave} value={chave}>
                    {rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            Ação
            <Select value={acao} onValueChange={setAcao}>
              <SelectTrigger aria-label="Filtrar por ação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as ações</SelectItem>
                {Object.entries(ACAO_LABEL).map(([chave, rotulo]) => (
                  <SelectItem key={chave} value={chave}>
                    {rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            De
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-medium">
            Até
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </label>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar histórico…</p>}
      {error && <ErrorState error={error} />}
      {data && registos.length === 0 && (
        <EmptyState
          titulo="Sem registos para estes filtros"
          descricao="Alargue o período ou escolha outra área."
          icone={<History className="size-5" aria-hidden="true" />}
        />
      )}
      {registos.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {registos.length} registo(s), do mais recente para o mais antigo.
          </p>
          <ListaHistorico registos={registos} />
        </section>
      )}
    </div>
  );
}
