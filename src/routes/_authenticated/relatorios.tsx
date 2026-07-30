import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, Fragment } from "react";
import { Download, FileCheck2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SemaforoBadge } from "@/components/status-badge";
import { TableScroll } from "@/components/data-table";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enviarArquivo, registrarDocumento } from "@/lib/licencas.functions";
import { invalidarDados, licencasQuery, unidadesQuery } from "@/lib/queries";
import {
  ORGAOS,
  STATUS_PENDENTES,
  TIPO_UNIDADE_LABEL,
  orgaoLabel,
  parseCnae,
  semaforoColor,
  statusLabel,
  tipoUnidadeLabel,
  type StatusLicenca,
} from "@/lib/domain";
import { formatDate, formatDaysLeft } from "@/lib/dates";
import { baixarCsv, sufixoData, type ColunaCsv } from "@/lib/csv";
import { mensagemErro } from "@/lib/errors";
import type { LicencaDashboard, Unidade } from "@/lib/rows";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/relatorios")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(licencasQuery),
      context.queryClient.ensureQueryData(unidadesQuery),
    ]),
  component: RelatoriosPage,
  pendingComponent: () => <PageSkeleton cartoes={6} colunas={7} />,
  head: () => ({
    meta: [
      { title: "Relatórios — IGESDF Compliance" },
      {
        name: "description",
        content:
          "Relatórios de conformidade por unidade e por órgão, com pendências, prazos de renovação e exportação PDF para auditoria.",
      },
      { property: "og:title", content: "Relatórios de conformidade — IGESDF" },
      {
        property: "og:description",
        content: "Relatórios de conformidade regulatória e exportação PDF para auditoria.",
      },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/relatorios" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/relatorios" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

type Modo = "unidade" | "orgao";

function colunasCsv(modo: Modo): ColunaCsv<LicencaDashboard>[] {
  return [
    {
      cabecalho: modo === "unidade" ? "Unidade" : "Órgão",
      valor: (d) => (modo === "unidade" ? d.unidade_nome : orgaoLabel(d.orgao)),
    },
    {
      cabecalho: modo === "unidade" ? "Órgão" : "Unidade",
      valor: (d) => (modo === "unidade" ? orgaoLabel(d.orgao) : d.unidade_nome),
    },
    { cabecalho: "CNAE", valor: (d) => parseCnae(d.descricao).codigo },
    { cabecalho: "Atividade", valor: (d) => parseCnae(d.descricao).label },
    { cabecalho: "Semáforo", valor: (d) => semaforoColor(d.semaforo ?? "").label },
    { cabecalho: "Situação", valor: (d) => statusLabel(d.status) },
    { cabecalho: "Número", valor: (d) => d.numero },
    { cabecalho: "Processo SEI", valor: (d) => d.processo_sei },
    { cabecalho: "Vencimento", valor: (d) => formatDate(d.data_vencimento) },
    { cabecalho: "Dias restantes", valor: (d) => d.dias_restantes },
    { cabecalho: "Observações", valor: (d) => d.observacoes },
  ];
}

function RelatoriosPage() {
  const { data } = useSuspenseQuery(licencasQuery);
  const { data: unidades } = useSuspenseQuery(unidadesQuery);
  const [modo, setModo] = useState<Modo>("unidade");
  const [unidadeF, setUnidadeF] = useState("todos");
  const [orgaoF, setOrgaoF] = useState("todos");
  const [tipoF, setTipoF] = useState("todos");
  const [apenasPendencias, setApenasPendencias] = useState(false);

  const tipoPorUnidade = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const u of unidades) mapa.set(u.id, u.tipo);
    return mapa;
  }, [unidades]);

  const filtrados = useMemo(
    () =>
      data.filter((d) => {
        if (unidadeF !== "todos" && d.unidade_id !== unidadeF) return false;
        if (orgaoF !== "todos" && d.orgao !== orgaoF) return false;
        if (tipoF !== "todos" && tipoPorUnidade.get(d.unidade_id ?? "") !== tipoF) return false;
        if (apenasPendencias && (d.status === "vigente" || d.status === "dispensada")) return false;
        return true;
      }),
    [data, unidadeF, orgaoF, tipoF, apenasPendencias, tipoPorUnidade],
  );

  const grupos = useMemo(() => {
    const mapa = new Map<string, LicencaDashboard[]>();
    for (const it of filtrados) {
      const chave = (modo === "unidade" ? it.unidade_nome : orgaoLabel(it.orgao)) ?? "—";
      const lista = mapa.get(chave);
      if (lista) lista.push(it);
      else mapa.set(chave, [it]);
    }
    // Ordena uma cópia de cada grupo. Antes o `.sort()` corria dentro do JSX,
    // mutando o array memoizado durante o render.
    return [...mapa.entries()]
      .map(
        ([nome, lista]) =>
          [
            nome,
            [...lista].sort((a, b) =>
              (a.data_vencimento ?? "9999").localeCompare(b.data_vencimento ?? "9999"),
            ),
          ] as [string, LicencaDashboard[]],
      )
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [filtrados, modo]);

  const kpis = useMemo(() => {
    const conta = (s: string) => filtrados.filter((d) => d.semaforo === s).length;
    return {
      total: filtrados.length,
      vigentes: filtrados.filter((d) => d.status === "vigente").length,
      pendentes: filtrados.filter((d) => STATUS_PENDENTES.includes(d.status as StatusLicenca))
        .length,
      alerta: conta("a_vencer_alerta"),
      criticas: conta("a_vencer_critico"),
      vencidas: conta("vencida"),
    };
  }, [filtrados]);

  function exportar() {
    baixarCsv(`conformidade-igesdf-${sufixoData()}`, filtrados, colunasCsv(modo));
  }

  return (
    <div className="print-area space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Relatórios de conformidade"
        descricao="Situação do licenciamento por unidade ou por órgão, com pendências e prazos de renovação."
        acoes={
          <>
            <Button variant="outline" onClick={exportar} disabled={filtrados.length === 0}>
              <Download className="mr-1 size-4" aria-hidden="true" /> Exportar planilha
            </Button>
            <PrintModeToggle defaultOrientation="landscape" />
          </>
        }
      />

      <Card className="no-print">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="rel-modo" className="text-xs text-muted-foreground">
              Agrupar por
            </Label>
            <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
              <SelectTrigger id="rel-modo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unidade">Unidade</SelectItem>
                <SelectItem value="orgao">Órgão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-tipo" className="text-xs text-muted-foreground">
              Tipo de unidade
            </Label>
            <Select
              value={tipoF}
              onValueChange={(v) => {
                setTipoF(v);
                setUnidadeF("todos");
              }}
            >
              <SelectTrigger id="rel-tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(TIPO_UNIDADE_LABEL).map(([chave, rotulo]) => (
                  <SelectItem key={chave} value={chave}>
                    {rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-unidade" className="text-xs text-muted-foreground">
              Unidade
            </Label>
            <Select value={unidadeF} onValueChange={setUnidadeF}>
              <SelectTrigger id="rel-unidade">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as unidades</SelectItem>
                {unidades
                  .filter((u) => tipoF === "todos" || u.tipo === tipoF)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rel-orgao" className="text-xs text-muted-foreground">
              Órgão
            </Label>
            <Select value={orgaoF} onValueChange={setOrgaoF}>
              <SelectTrigger id="rel-orgao">
                <SelectValue placeholder="Órgão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os órgãos</SelectItem>
                {ORGAOS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              variant={apenasPendencias ? "default" : "outline"}
              aria-pressed={apenasPendencias}
              onClick={() => setApenasPendencias((v) => !v)}
            >
              {apenasPendencias ? "Mostrando só pendências" : "Só pendências"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="print-only mb-4">
        <h1 className="text-xl font-semibold">Relatório de conformidade — IGESDF</h1>
        <p className="text-xs">
          Agrupado por {modo === "unidade" ? "unidade" : "órgão"}
          {tipoF !== "todos" && <span> · Tipo: {tipoUnidadeLabel(tipoF)}</span>}
          {unidadeF !== "todos" && (
            <span> · Unidade: {unidades.find((u) => u.id === unidadeF)?.nome}</span>
          )}
          {orgaoF !== "todos" && <span> · Órgão: {orgaoLabel(orgaoF)}</span>}
          {apenasPendencias && <span> · Apenas pendências</span>}
          <span> · Emitido em {formatDate(new Date().toISOString())}</span>
        </p>
        <p className="mt-1 text-xs">
          Total: {kpis.total} · Vigentes: {kpis.vigentes} · Pendentes: {kpis.pendentes} · A vencer
          ≤90d: {kpis.alerta} · Crítico ≤60d: {kpis.criticas} · Vencidas: {kpis.vencidas}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 no-print sm:grid-cols-3 lg:grid-cols-6">
        {[
          { chave: "Total", valor: kpis.total, cls: "bg-muted" },
          { chave: "Vigentes", valor: kpis.vigentes, cls: "bg-success/15 text-success" },
          { chave: "Pendentes", valor: kpis.pendentes, cls: "bg-info/15 text-info" },
          { chave: "A vencer", valor: kpis.alerta, cls: "bg-warning/20 text-warning-foreground" },
          { chave: "Crítico", valor: kpis.criticas, cls: "bg-destructive/15 text-destructive" },
          { chave: "Vencidas", valor: kpis.vencidas, cls: "bg-destructive/25 text-destructive" },
        ].map((x) => (
          <div key={x.chave} className={cn("rounded-lg border p-3", x.cls)}>
            <div className="text-xs">{x.chave}</div>
            <div className="text-2xl font-semibold">{x.valor}</div>
          </div>
        ))}
      </div>

      {grupos.map(([nome, itens]) => (
        <Card key={nome}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {nome}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {itens.length} registro(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableScroll>
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">{modo === "unidade" ? "Órgão" : "Unidade"}</th>
                    <th className="p-2 font-medium">CNAE</th>
                    <th className="p-2 font-medium">Atividade</th>
                    <th className="p-2 font-medium">Semáforo</th>
                    <th className="p-2 font-medium">Situação</th>
                    <th className="p-2 font-medium">Nº / SEI</th>
                    <th className="p-2 font-medium">Vencimento</th>
                    <th className="p-2 font-medium">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((d) => {
                    const cnae = parseCnae(d.descricao);
                    return (
                      <Fragment key={d.id}>
                        <tr className="print-row border-b last:border-0">
                          <td className="p-2 whitespace-nowrap">
                            {modo === "unidade" ? orgaoLabel(d.orgao) : d.unidade_nome}
                          </td>
                          <td className="p-2 font-mono text-xs whitespace-nowrap">
                            {cnae.codigo ?? "—"}
                          </td>
                          <td className="p-2 text-xs">{cnae.label ?? "—"}</td>
                          <td className="p-2">
                            <SemaforoBadge semaforo={d.semaforo} />
                          </td>
                          <td className="p-2 text-xs">{statusLabel(d.status)}</td>
                          <td className="p-2 text-xs">
                            {[d.numero, d.processo_sei].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td className="p-2 whitespace-nowrap">{formatDate(d.data_vencimento)}</td>
                          <td
                            className={cn(
                              "p-2 text-xs whitespace-nowrap",
                              (d.dias_restantes ?? 0) < 0 && "font-medium text-destructive",
                            )}
                          >
                            {formatDaysLeft(d.dias_restantes)}
                          </td>
                        </tr>
                        {d.observacoes && (
                          <tr className="border-b last:border-0">
                            <td
                              colSpan={8}
                              className="px-2 pb-2 text-xs italic text-muted-foreground"
                            >
                              Obs.: {d.observacoes}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </CardContent>
        </Card>
      ))}

      {grupos.length === 0 && (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              titulo="Sem registros para estes filtros"
              descricao="Reveja o tipo de unidade, a unidade e o órgão selecionados."
            />
          </CardContent>
        </Card>
      )}

      <UploadCertificados unidades={unidades} />
    </div>
  );
}

/** Arquiva o certificado REDESIM (ou equivalente) com trilha de auditoria. */
function UploadCertificados({ unidades }: { unidades: Unidade[] }) {
  const qc = useQueryClient();
  const [unidadeId, setUnidadeId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");
  const [validade, setValidade] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo || !unidadeId) return;
    setOcupado(true);
    try {
      const formulario = new FormData();
      formulario.append("arquivo", arquivo);
      formulario.append("prefixo", `certificados/${unidadeId}`);
      const enviado = await enviarArquivo({ data: formulario });
      await registrarDocumento({
        data: {
          ...enviado,
          unidade_id: unidadeId,
          categoria: "certificado",
          descricao: descricao || null,
          data_validade: validade || null,
        },
      });
      toast.success("Certificado arquivado");
      setArquivo(null);
      setDescricao("");
      setValidade("");
      invalidarDados(qc);
    } catch (erro) {
      toast.error(mensagemErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="no-print">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="size-4" aria-hidden="true" /> Arquivar certificado da unidade
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Envie o certificado REDESIM ou equivalente. Fica guardado na unidade com trilha de
          auditoria e controle de validade.
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-5" onSubmit={enviar}>
          <div className="space-y-1.5">
            <Label htmlFor="cert-unidade" className="text-xs">
              Unidade
            </Label>
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger id="cert-unidade">
                <SelectValue placeholder="Escolher unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cert-arquivo" className="text-xs">
              Arquivo (PDF ou imagem)
            </Label>
            <Input
              id="cert-arquivo"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cert-descricao" className="text-xs">
              Descrição
            </Label>
            <Input
              id="cert-descricao"
              placeholder="Ex.: Certificado REDESIM 07/2026"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cert-validade" className="text-xs">
              Validade
            </Label>
            <Input
              id="cert-validade"
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={ocupado || !arquivo || !unidadeId}>
            <Upload className="mr-1 size-4" aria-hidden="true" />
            {ocupado ? "Enviando…" : "Arquivar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
