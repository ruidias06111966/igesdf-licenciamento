import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ArrowLeft, FileText, ListChecks, UserCog } from "lucide-react";
import { ErrorState, PageSkeleton } from "@/components/states";
import { SemaforoBadge } from "@/components/status-badge";
import { TableScroll } from "@/components/data-table";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dossieQuery } from "@/lib/queries";
import {
  STATUS_PENDENTES,
  calcularSemaforo,
  checklistStatusLabel,
  orgaoDescricao,
  orgaoLabel,
  parseCnae,
  situacaoEdificacaoLabel,
  statusLabel,
  tipoUnidadeLabel,
  type StatusLicenca,
} from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/dates";
import { applyPrintMode, getSavedPrintMode } from "@/lib/print-mode";
import type { ChecklistItemDossie, Licenca } from "@/lib/rows";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/unidades/$id_/dossie")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(dossieQuery(params.id)),
  component: Dossie,
  pendingComponent: () => <PageSkeleton cartoes={6} colunas={7} />,
  validateSearch: (s: Record<string, unknown>) =>
    ({ print: s.print ? 1 : undefined }) as { print?: 1 },
  head: ({ params }) => ({
    meta: [
      { title: "Dossiê da unidade — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Dossiê consolidado de conformidade da unidade: licenças por órgão, checklists, documentos e responsáveis técnicos, pronto para auditoria.",
      },
      { property: "og:title", content: "Dossiê de conformidade — IGESDF" },
      {
        property: "og:description",
        content: "Relatório consolidado de conformidade da unidade IGESDF.",
      },
      {
        property: "og:url",
        content: `https://igesdf-licenciamento.qidominios.tech/unidades/${params.id}/dossie`,
      },
      { name: "robots", content: "noindex" },
    ],
    links: [
      {
        rel: "canonical",
        href: `https://igesdf-licenciamento.qidominios.tech/unidades/${params.id}/dossie`,
      },
    ],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

const ICONE_CHECKLIST: Record<string, string> = {
  concluido: "✅",
  em_curso: "🟡",
  nao_aplicavel: "➖",
  pendente: "⬜",
};

function Dossie() {
  const { id } = Route.useParams();
  const { print } = Route.useSearch();
  const { data } = useSuspenseQuery(dossieQuery(id));
  const { unidade, licencas, responsaveis, documentos, cnaes, checklist } = data;

  // Dossiê é sempre retrato, independentemente da preferência global.
  useEffect(() => {
    document.body.classList.add("print-portrait");
    return () => document.body.classList.remove("print-portrait");
  }, []);

  // Abre a janela de impressão quando chegamos pelo botão "Dossiê PDF".
  useEffect(() => {
    if (print !== 1) return;
    const salvo = getSavedPrintMode();
    applyPrintMode("portrait", salvo.scale);
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [print]);

  const kpi = useMemo(() => {
    const semaforos = licencas.map(calcularSemaforo);
    const conta = (s: string) => semaforos.filter((x) => x === s).length;
    return {
      total: licencas.length,
      vigentes: conta("vigente"),
      vencidas: conta("vencida"),
      criticas: conta("a_vencer_critico"),
      alerta: conta("a_vencer_alerta"),
      pendentes: licencas.filter((l) => STATUS_PENDENTES.includes(l.status as StatusLicenca))
        .length,
    };
  }, [licencas]);

  const porOrgao = useMemo(() => {
    const mapa = new Map<string, Licenca[]>();
    for (const l of licencas) {
      const lista = mapa.get(l.orgao);
      if (lista) lista.push(l);
      else mapa.set(l.orgao, [l]);
    }
    return [...mapa.entries()].sort(([a], [b]) =>
      orgaoLabel(a).localeCompare(orgaoLabel(b), "pt-BR"),
    );
  }, [licencas]);

  const dadosCabecalho = [
    { rotulo: "Nº IGES", valor: unidade.numero_iges?.toString() ?? "—" },
    { rotulo: "Tipo", valor: tipoUnidadeLabel(unidade.tipo) },
    { rotulo: "CNPJ", valor: unidade.cnpj ?? "—" },
    { rotulo: "CF/DF", valor: unidade.cf_df ?? "—" },
    { rotulo: "Processo SEI", valor: unidade.processo_sei ?? "—" },
    { rotulo: "Edificação", valor: situacaoEdificacaoLabel(unidade.situacao_edificacao) },
    { rotulo: "Região administrativa", valor: unidade.regiao_administrativa ?? "—" },
  ];

  return (
    <div className="print-area mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-2 no-print">
        <Button asChild variant="ghost" size="sm">
          <Link to="/unidades/$id" params={{ id }}>
            <ArrowLeft className="mr-1 size-4" aria-hidden="true" /> Voltar à unidade
          </Link>
        </Button>
        <div className="ml-auto">
          <PrintModeToggle defaultOrientation="portrait" />
        </div>
      </div>

      <header className="border-b pb-4">
        <div className="text-xs text-muted-foreground">
          Relatório de conformidade — IGESDF · emitido em {formatDate(new Date().toISOString())}
        </div>
        <h1 className="mt-1 text-2xl font-semibold">Dossiê · {unidade.nome}</h1>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground md:grid-cols-4">
          {dadosCabecalho.map((d) => (
            <div key={d.rotulo}>
              <dt className="inline">{d.rotulo}: </dt>
              <dd className="inline font-semibold text-foreground">{d.valor}</dd>
            </div>
          ))}
          {unidade.endereco && (
            <div className="col-span-full">
              <dt className="inline">Endereço: </dt>
              <dd className="inline">{unidade.endereco}</dd>
            </div>
          )}
        </dl>
      </header>

      <section className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {[
          { chave: "Total", valor: kpi.total, cls: "bg-muted" },
          { chave: "Vigentes", valor: kpi.vigentes, cls: "bg-success/15 text-success" },
          { chave: "Pendentes", valor: kpi.pendentes, cls: "bg-info/15 text-info" },
          { chave: "A vencer", valor: kpi.alerta, cls: "bg-warning/20 text-warning-foreground" },
          { chave: "Crítico", valor: kpi.criticas, cls: "bg-destructive/15 text-destructive" },
          { chave: "Vencidas", valor: kpi.vencidas, cls: "bg-destructive/25 text-destructive" },
        ].map((x) => (
          <div key={x.chave} className={cn("rounded-md p-3", x.cls)}>
            <div className="text-xs">{x.chave}</div>
            <div className="text-2xl font-semibold">{x.valor}</div>
          </div>
        ))}
      </section>

      {porOrgao.map(([orgao, itens]) => {
        const itensChecklist = (checklist as ChecklistItemDossie[]).filter(
          (c) => c.licencas?.orgao === orgao,
        );
        const concluidos = itensChecklist.filter((i) => i.status === "concluido").length;
        return (
          <Card key={orgao}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {orgaoLabel(orgao)}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {orgaoDescricao(orgao)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
              <TableScroll>
                <table className="w-full text-xs">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="p-1.5 font-medium">CNAE</th>
                      <th className="p-1.5 font-medium">Atividade</th>
                      <th className="p-1.5 font-medium">Situação</th>
                      <th className="p-1.5 font-medium">Nº / SEI</th>
                      <th className="p-1.5 font-medium">Emissão</th>
                      <th className="p-1.5 font-medium">Vencimento</th>
                      <th className="p-1.5 font-medium">Semáforo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((l) => {
                      const cnae = parseCnae(l.descricao);
                      return (
                        <tr key={l.id} className="print-row border-b last:border-0">
                          <td className="p-1.5 font-mono">{cnae.codigo ?? "—"}</td>
                          <td className="p-1.5">{cnae.label ?? "—"}</td>
                          <td className="p-1.5">{statusLabel(l.status)}</td>
                          <td className="p-1.5">
                            {[l.numero, l.processo_sei].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td className="p-1.5">{formatDate(l.data_emissao)}</td>
                          <td className="p-1.5">{formatDate(l.data_vencimento)}</td>
                          <td className="p-1.5">
                            <SemaforoBadge licenca={l} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>

              {itensChecklist.length > 0 && (
                <div className="border-t pt-2">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium">
                    <ListChecks className="size-3" aria-hidden="true" /> Checklist ({concluidos}/
                    {itensChecklist.length} concluídos)
                  </div>
                  <ul className="space-y-0.5 text-xs">
                    {itensChecklist.map((it) => (
                      <li
                        key={it.id}
                        className="flex justify-between gap-2 border-b py-0.5 last:border-0"
                      >
                        <span>
                          {ICONE_CHECKLIST[it.status] ?? "⬜"} {it.titulo}
                        </span>
                        <span className="text-right text-muted-foreground">
                          {it.responsavel ?? "—"}
                          {it.data_conclusao ? ` · ${formatDate(it.data_conclusao)}` : ""} ·{" "}
                          {checklistStatusLabel(it.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {itens.some((l) => l.observacoes) && (
                <div className="space-y-0.5 border-t pt-2 text-xs italic text-muted-foreground">
                  {itens
                    .filter((l) => l.observacoes)
                    .map((l) => (
                      <div key={l.id}>
                        Obs. {parseCnae(l.descricao).codigo ?? ""}: {l.observacoes}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {licencas.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma licença registrada para esta unidade.
          </CardContent>
        </Card>
      )}

      {cnaes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CNAEs cadastrados ({cnaes.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <TableScroll>
              <table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-1.5 font-medium">Código</th>
                    <th className="p-1.5 font-medium">Descrição</th>
                    <th className="p-1.5 font-medium">Situação</th>
                    <th className="p-1.5 font-medium">Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {cnaes.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-1.5 font-mono">{c.codigo}</td>
                      <td className="p-1.5">{c.descricao}</td>
                      <td className="p-1.5">{statusLabel(c.status)}</td>
                      <td className="p-1.5">{formatDate(c.data_vencimento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </CardContent>
        </Card>
      )}

      {responsaveis.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="size-4" aria-hidden="true" /> Responsáveis técnicos (
              {responsaveis.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ul className="space-y-1 text-xs">
              {responsaveis.map((r) => (
                <li key={r.id} className="border-b pb-1 last:border-0">
                  <strong>{r.nome}</strong> —{" "}
                  {[r.conselho, r.numero_registro].filter(Boolean).join(" ")} · {r.cargo ?? "—"}
                  {r.email && ` · ${r.email}`}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {documentos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden="true" /> Documentos vigentes (
              {documentos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <TableScroll>
              <table className="w-full text-xs">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-1.5 font-medium">Nome</th>
                    <th className="p-1.5 font-medium">Categoria</th>
                    <th className="p-1.5 font-medium">Versão</th>
                    <th className="p-1.5 font-medium">Validade</th>
                    <th className="p-1.5 font-medium">Enviado em</th>
                  </tr>
                </thead>
                <tbody>
                  {documentos.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="p-1.5">{d.nome}</td>
                      <td className="p-1.5">{d.categoria}</td>
                      <td className="p-1.5">v{d.versao}</td>
                      <td className="p-1.5">{formatDate(d.data_validade)}</td>
                      <td className="p-1.5">{formatDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </CardContent>
        </Card>
      )}

      <footer className="print-only border-t pt-2 text-xs text-muted-foreground">
        Relatório gerado por IGESDF - Licenciamento · {formatDateTime(new Date().toISOString())}
      </footer>
    </div>
  );
}
