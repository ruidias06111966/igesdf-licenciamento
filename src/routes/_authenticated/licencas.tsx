import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SemaforoBadge } from "@/components/status-badge";
import { SortableTh, TableScroll } from "@/components/data-table";
import { useOrdenacao } from "@/lib/use-ordenacao";
import { ConfirmDelete } from "@/components/confirm-delete";
import { HistoricoEntidade } from "@/components/historico-entidade";
import { LicencaForm, type ValoresLicenca } from "@/components/forms/licenca-form";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteLicenca } from "@/lib/licencas.functions";
import { invalidarDados, licencasQuery, unidadesQuery } from "@/lib/queries";
import {
  GRUPO_RISCO_INFO,
  ORGAOS,
  calcularSemaforo,
  grupoRisco,
  orgaoLabel,
  parseCnae,
  semaforoColor,
  statusLabel,
  type GrupoRisco,
} from "@/lib/domain";
import { formatDate, formatDaysLeft } from "@/lib/dates";
import { sufixoData, type ColunaCsv } from "@/lib/csv";
import { BotaoExportar } from "@/components/botao-exportar";
import type { LicencaDashboard } from "@/lib/rows";
import { cn } from "@/lib/utils";

/**
 * Filtros no URL, e não em `useState`.
 *
 * Assim os cartões do painel podem apontar para a listagem já filtrada — clicar
 * em "12 vencidas" abre exatamente essas 12, e não a lista inteira — e o
 * endereço resultante pode ser guardado ou enviado a um colega.
 */
type Filtros = {
  q?: string;
  unidade?: string;
  orgao?: string;
  semaforo?: string;
  cnae?: string;
  grupo?: GrupoRisco;
};

const GRUPOS_VALIDOS: GrupoRisco[] = ["A", "B", "C"];

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() !== "" ? valor : undefined;
}

export const Route = createFileRoute("/_authenticated/licencas")({
  validateSearch: (entrada: Record<string, unknown>): Filtros => ({
    q: texto(entrada.q),
    unidade: texto(entrada.unidade),
    orgao: texto(entrada.orgao),
    semaforo: texto(entrada.semaforo),
    cnae: texto(entrada.cnae),
    grupo: GRUPOS_VALIDOS.includes(entrada.grupo as GrupoRisco)
      ? (entrada.grupo as GrupoRisco)
      : undefined,
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(licencasQuery),
      context.queryClient.ensureQueryData(unidadesQuery),
    ]),
  component: LicencasPage,
  pendingComponent: () => <PageSkeleton colunas={7} linhas={8} />,
  head: () => ({
    meta: [
      { title: "Licenças — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Listagem global de licenças e alvarás por unidade, CNAE e órgão (VISADF, CBMDF, IBRAM, DF LEGAL) da rede IGESDF.",
      },
      { property: "og:title", content: "Licenças — IGESDF - Licenciamento" },
      {
        property: "og:description",
        content: "Gestão global de licenças e alvarás da rede hospitalar do IGESDF.",
      },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/licencas" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/licencas" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

type Coluna = "unidade" | "orgao" | "cnae" | "atividade" | "situacao" | "vencimento";

const COLUNAS_CSV: ColunaCsv<LicencaDashboard>[] = [
  { cabecalho: "Unidade", valor: (d) => d.unidade_nome },
  { cabecalho: "Nº IGES", valor: (d) => d.numero_iges },
  { cabecalho: "Órgão", valor: (d) => orgaoLabel(d.orgao) },
  { cabecalho: "CNAE", valor: (d) => parseCnae(d.descricao).codigo },
  { cabecalho: "Atividade", valor: (d) => parseCnae(d.descricao).label },
  { cabecalho: "Situação", valor: (d) => statusLabel(d.status), situacao: true },
  {
    cabecalho: "Semáforo",
    valor: (d) => semaforoColor(d.semaforo ?? "").label,
    situacao: true,
  },
  { cabecalho: "Número", valor: (d) => d.numero },
  { cabecalho: "Processo SEI", valor: (d) => d.processo_sei },
  { cabecalho: "Emissão", valor: (d) => formatDate(d.data_emissao) },
  { cabecalho: "Vencimento", valor: (d) => formatDate(d.data_vencimento) },
  { cabecalho: "Dias restantes", valor: (d) => d.dias_restantes },
  { cabecalho: "Observações", valor: (d) => d.observacoes },
];

function LicencasPage() {
  const { data } = useSuspenseQuery(licencasQuery);
  const { data: unidades } = useSuspenseQuery(unidadesQuery);
  const qc = useQueryClient();

  const filtros = Route.useSearch();
  const navegar = useNavigate({ from: Route.fullPath });

  /**
   * Ids gravados nesta sessão de trabalho. Uma licença acabada de gravar fica
   * sempre visível, mesmo que os filtros ativos (órgão, situação, busca…) a
   * excluíssem — era isso que dava a impressão de a licença ter desaparecido
   * depois de uma simples alteração.
   */
  const [recemGravadas, setRecemGravadas] = useState<Set<string>>(() => new Set());

  // "todos" é apenas o rótulo do seletor; no URL o filtro ausente é omitido.
  const orgao = filtros.orgao ?? "todos";
  const semaforo = filtros.semaforo ?? "todos";
  const unidadeF = filtros.unidade ?? "todos";
  const cnaeF = filtros.cnae ?? "todos";
  const busca = filtros.q ?? "";
  const grupo: GrupoRisco | undefined = filtros.grupo;

  const definir = (patch: Partial<Filtros>) =>
    void navegar({
      search: (atual: Filtros) => {
        const proximo: Filtros = { ...atual, ...patch };
        for (const chave of Object.keys(proximo) as (keyof Filtros)[]) {
          if (proximo[chave] === "todos" || proximo[chave] === "") delete proximo[chave];
        }
        return proximo;
      },
      replace: true,
    });

  const temFiltro = Object.values(filtros).some(Boolean);

  const cnaesUnicos = useMemo(
    () =>
      [
        ...new Set(data.map((d) => parseCnae(d.descricao).codigo).filter(Boolean)),
      ].sort() as string[],
    [data],
  );

  const filtrado = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return data.filter((d) => {
      if (d.id && recemGravadas.has(d.id)) return true;
      if (orgao !== "todos" && d.orgao !== orgao) return false;
      if (semaforo !== "todos" && d.semaforo !== semaforo) return false;
      if (unidadeF !== "todos" && d.unidade_id !== unidadeF) return false;
      if (cnaeF !== "todos" && parseCnae(d.descricao).codigo !== cnaeF) return false;
      if (grupo && grupoRisco(d) !== grupo) return false;
      if (termo) {
        const alvo = [d.unidade_nome, d.descricao, d.numero, d.processo_sei, d.observacoes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [data, orgao, semaforo, unidadeF, cnaeF, busca, grupo, recemGravadas]);

  const { ordenados, ordem, alternar } = useOrdenacao<LicencaDashboard, Coluna>(
    filtrado,
    {
      unidade: (d) => d.unidade_nome,
      orgao: (d) => orgaoLabel(d.orgao),
      cnae: (d) => parseCnae(d.descricao).codigo,
      atividade: (d) => parseCnae(d.descricao).label,
      situacao: (d) => semaforoColor(d.semaforo ?? "").peso,
      vencimento: (d) => d.data_vencimento,
    },
    { chave: "situacao", direcao: "asc" },
  );

  function limpar() {
    setRecemGravadas(new Set());
    void navegar({ search: {}, replace: true });
  }

  /**
   * Depois de gravar, confirma se o registo continua visível com os filtros
   * ativos. Alterar a situação (por exemplo para "Dispensada") muda o semáforo
   * e podia retirar a linha da lista sem qualquer aviso — parecia que a licença
   * tinha sido apagada.
   */
  function avisarSeForaDoFiltro(v: ValoresLicenca, id?: string) {
    if (id) setRecemGravadas((atual) => new Set(atual).add(id));
    if (!temFiltro) return;
    const semaforoNovo = calcularSemaforo({
      status: v.status,
      data_vencimento: v.data_vencimento || null,
    });
    const foraOrgao = orgao !== "todos" && v.orgao !== orgao;
    const foraUnidade = unidadeF !== "todos" && v.unidade_id !== unidadeF;
    const foraSemaforo = semaforo !== "todos" && semaforoNovo !== semaforo;
    const foraCnae = cnaeF !== "todos" && parseCnae(v.descricao).codigo !== cnaeF;
    const termo = busca.trim().toLowerCase();
    const foraBusca =
      termo.length > 0 &&
      ![v.descricao, v.numero, v.processo_sei, v.observacoes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(termo);
    if (!foraOrgao && !foraUnidade && !foraSemaforo && !foraCnae && !foraBusca && !grupo) return;
    toast.warning("Registro salvo — fora dos filtros atuais", {
      description:
        "A licença continua cadastrada e fica assinalada na lista até limpar os filtros.",
      duration: 10000,
      action: { label: "Limpar filtros", onClick: limpar },
    });
  }

  const invalidar = () => invalidarDados(qc);

  return (
    <div className="print-area space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Licenças e alvarás"
        descricao={
          temFiltro
            ? `${ordenados.length} de ${data.length} registros no filtro atual.`
            : `${data.length} registros na rede.`
        }
        acoes={
          <>
            <BotaoExportar
              nomeArquivo={`licencas-igesdf-${sufixoData()}`}
              titulo="IGESDF — Licenças e alvarás"
              subtitulo={`${ordenados.length} registro(s) · gerado em ${new Date().toLocaleString("pt-BR")}`}
              folha="Licenças"
              linhas={ordenados}
              colunas={COLUNAS_CSV}
              rotulo="Exportar planilha"
            />
            <PrintModeToggle defaultOrientation="landscape" />
            <LicencaForm
              unidades={unidades}
              unidadeId={unidades[0]?.id}
              onSaved={avisarSeForaDoFiltro}
              trigger={
                <Button>
                  <Plus className="mr-1 size-4" aria-hidden="true" /> Nova licença
                </Button>
              }
            />
          </>
        }
      />

      {grupo && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm no-print">
          <span className="font-medium">{GRUPO_RISCO_INFO[grupo].titulo}</span>
          <span className="text-muted-foreground">{GRUPO_RISCO_INFO[grupo].descricao}</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => definir({ grupo: undefined })}
          >
            Remover este filtro
          </Button>
        </div>
      )}

      <div className="print-only mb-4">
        <h1 className="text-xl font-semibold">Licenças — IGESDF</h1>
        <p className="text-xs">
          {unidadeF !== "todos" && (
            <span>Unidade: {unidades.find((u) => u.id === unidadeF)?.nome} · </span>
          )}
          {orgao !== "todos" && <span>Órgão: {orgaoLabel(orgao)} · </span>}
          {cnaeF !== "todos" && <span>CNAE: {cnaeF} · </span>}
          {grupo && <span>{GRUPO_RISCO_INFO[grupo].titulo} · </span>}
          Total: {ordenados.length} · Emitido em {formatDate(new Date().toISOString())}
        </p>
      </div>

      <Card className="no-print">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="Buscar unidade, nº, SEI…"
              aria-label="Buscar licenças"
              value={busca}
              onChange={(e) => definir({ q: e.target.value })}
            />
          </div>
          <Select value={unidadeF} onValueChange={(v) => definir({ unidade: v })}>
            <SelectTrigger aria-label="Filtrar por unidade">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={orgao} onValueChange={(v) => definir({ orgao: v })}>
            <SelectTrigger aria-label="Filtrar por órgão">
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
          <Select value={cnaeF} onValueChange={(v) => definir({ cnae: v })}>
            <SelectTrigger aria-label="Filtrar por CNAE">
              <SelectValue placeholder="CNAE" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os CNAEs</SelectItem>
              {cnaesUnicos.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={semaforo} onValueChange={(v) => definir({ semaforo: v })}>
              <SelectTrigger aria-label="Filtrar por situação">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                <SelectItem value="vencida">Vencidas</SelectItem>
                <SelectItem value="a_vencer_critico">Crítico (≤60d)</SelectItem>
                <SelectItem value="a_vencer_alerta">A vencer (≤90d)</SelectItem>
                <SelectItem value="vigente">Vigentes</SelectItem>
                <SelectItem value="dispensada">Dispensadas</SelectItem>
                <SelectItem value="indeferida">Indeferidas</SelectItem>
              </SelectContent>
            </Select>
            {temFiltro && (
              <Button variant="ghost" onClick={limpar} className="shrink-0">
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <SortableTh chave="unidade" ordem={ordem} alternar={alternar}>
                    Unidade
                  </SortableTh>
                  <SortableTh chave="orgao" ordem={ordem} alternar={alternar}>
                    Órgão
                  </SortableTh>
                  <SortableTh chave="cnae" ordem={ordem} alternar={alternar}>
                    CNAE
                  </SortableTh>
                  <SortableTh chave="atividade" ordem={ordem} alternar={alternar}>
                    Atividade
                  </SortableTh>
                  <SortableTh chave="situacao" ordem={ordem} alternar={alternar}>
                    Situação
                  </SortableTh>
                  <th className="print-only-cell p-3 font-medium">Status cadastrado</th>
                  <th className="print-only-cell p-3 font-medium">Nº</th>
                  <th className="print-only-cell p-3 font-medium">Processo SEI</th>
                  <SortableTh chave="vencimento" ordem={ordem} alternar={alternar}>
                    Vencimento
                  </SortableTh>
                  <th className="p-3 font-medium">Prazo</th>
                  <th className="p-3 text-right font-medium no-print">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((d) => {
                  const cnae = parseCnae(d.descricao);
                  const gravadaAgora = Boolean(d.id && recemGravadas.has(d.id));
                  return (
                    <Fragment key={d.id}>
                      <tr
                        className={cn(
                          "print-row border-b hover:bg-muted/30",
                          gravadaAgora && "bg-primary/5",
                        )}
                      >
                        <td className="p-3">
                          {gravadaAgora && (
                            <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary no-print">
                              guardada agora
                            </span>
                          )}
                          {d.unidade_id ? (
                            <Link
                              to="/unidades/$id"
                              params={{ id: d.unidade_id }}
                              className="font-medium hover:underline"
                            >
                              {d.unidade_nome}
                            </Link>
                          ) : (
                            <span className="font-medium">{d.unidade_nome}</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">{orgaoLabel(d.orgao)}</td>
                        <td className="p-3 font-mono text-xs whitespace-nowrap">
                          {cnae.codigo ?? "—"}
                        </td>
                        <td
                          className="max-w-xs truncate p-3 text-xs"
                          title={cnae.label ?? undefined}
                        >
                          {cnae.label ?? "—"}
                        </td>
                        <td className="p-3">
                          <SemaforoBadge semaforo={d.semaforo} />
                        </td>
                        <td className="print-only-cell p-3 text-xs">{statusLabel(d.status)}</td>
                        <td className="print-only-cell p-3 text-xs">{d.numero ?? "—"}</td>
                        <td className="print-only-cell p-3 text-xs">{d.processo_sei ?? "—"}</td>
                        <td className="p-3 whitespace-nowrap">{formatDate(d.data_vencimento)}</td>
                        <td
                          className={cn(
                            "p-3 text-xs whitespace-nowrap",
                            (d.dias_restantes ?? 0) < 0 && "font-medium text-destructive",
                          )}
                        >
                          {formatDaysLeft(d.dias_restantes)}
                        </td>
                        <td className="space-x-1 p-3 text-right whitespace-nowrap no-print">
                          <LicencaForm
                            licenca={d}
                            unidades={unidades}
                            unidadeId={d.unidade_id ?? undefined}
                            onSaved={avisarSeForaDoFiltro}
                            trigger={
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Editar licença ${orgaoLabel(d.orgao)} de ${d.unidade_nome}`}
                                title="Editar"
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </Button>
                            }
                          />
                          {d.id && (
                            <HistoricoEntidade
                              entidade="licencas"
                              entidadeId={d.id}
                              titulo={`${orgaoLabel(d.orgao)} — ${d.unidade_nome ?? ""}`}
                            />
                          )}
                          {d.id && (
                            <ConfirmDelete
                              titulo="Excluir licença"
                              descricao="O registro da licença e o seu checklist são removidos definitivamente. Os documentos anexados permanecem na unidade."
                              mensagemSucesso="Licença excluída"
                              onConfirm={() => deleteLicenca({ data: { id: d.id as string } })}
                              onDone={invalidar}
                            />
                          )}
                        </td>
                      </tr>
                      {d.observacoes && (
                        <tr className="print-only-row border-b last:border-0">
                          <td
                            colSpan={11}
                            className="px-3 pb-2 text-xs italic text-muted-foreground"
                          >
                            Obs.: {d.observacoes}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {ordenados.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-0">
                      <EmptyState
                        titulo={
                          data.length === 0
                            ? "Nenhuma licença cadastrada"
                            : "Nenhum resultado para estes filtros"
                        }
                        descricao={
                          data.length === 0
                            ? "Cadastre a primeira licença para começar a acompanhar prazos e renovações."
                            : "Reveja a busca e os filtros selecionados."
                        }
                        acao={
                          temFiltro ? (
                            <Button size="sm" variant="outline" onClick={limpar}>
                              Limpar filtros
                            </Button>
                          ) : (
                            <LicencaForm
                              unidades={unidades}
                              unidadeId={unidades[0]?.id}
                              trigger={
                                <Button size="sm">
                                  <Plus className="mr-1 size-4" aria-hidden="true" /> Nova licença
                                </Button>
                              }
                            />
                          )
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </CardContent>
      </Card>
    </div>
  );
}
