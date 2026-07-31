import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileBarChart2, FileText, ListChecks, Pencil, Plus, UserCog } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SemaforoBadge } from "@/components/status-badge";
import { TableScroll } from "@/components/data-table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ChecklistInline } from "@/components/checklist-inline";
import { DocRow, DocsLicenca, UploadDoc } from "@/components/documentos";
import { CnaeForm } from "@/components/forms/cnae-form";
import { LicencaForm } from "@/components/forms/licenca-form";
import { RTForm } from "@/components/forms/rt-form";
import { UnidadeForm } from "@/components/forms/unidade-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteCnae, deleteLicenca, deleteRT, deleteUnidade } from "@/lib/licencas.functions";
import { invalidarDados, unidadeQuery } from "@/lib/queries";
import {
  orgaoDescricao,
  orgaoLabel,
  parseCnae,
  situacaoEdificacaoLabel,
  statusLabel,
  tipoUnidadeLabel,
} from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import type { CnaeUnidade, Documento, Licenca, Unidade } from "@/lib/rows";

export const Route = createFileRoute("/_authenticated/unidades/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(unidadeQuery(params.id)),
  component: UnidadeDetalhe,
  pendingComponent: () => <PageSkeleton colunas={6} linhas={5} />,
  head: ({ params }) => ({
    meta: [
      { title: "Unidade — IGESDF Compliance" },
      {
        name: "description",
        content:
          "Ficha detalhada da unidade: CNAEs, licenças por órgão, documentos versionados, checklists e responsáveis técnicos.",
      },
      { property: "og:title", content: "Ficha da unidade — IGESDF Compliance" },
      {
        property: "og:description",
        content: "Detalhe de licenciamento, documentos e checklists da unidade IGESDF.",
      },
      {
        property: "og:url",
        content: `https://igesdf-licenciamento.qidominios.tech/unidades/${params.id}`,
      },
    ],
    links: [
      {
        rel: "canonical",
        href: `https://igesdf-licenciamento.qidominios.tech/unidades/${params.id}`,
      },
    ],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function UnidadeDetalhe() {
  const { id } = Route.useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(unidadeQuery(id));
  const { unidade, licencas, responsaveis, documentos, cnaes } = data;

  const invalidar = () => invalidarDados(qc);
  const docsGerais = documentos.filter((d) => !d.licenca_id && d.ativo !== false);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        migalhas={[{ label: "Unidades", to: "/unidades" }, { label: unidade.nome }]}
        titulo={unidade.nome}
        descricao={<DadosUnidade unidade={unidade} />}
        acoes={
          <>
            <Button asChild variant="outline">
              <Link to="/unidades/$id_/dossie" params={{ id }}>
                <FileBarChart2 className="mr-1 size-4" aria-hidden="true" /> Dossiê / PDF
              </Link>
            </Button>
            <UnidadeForm
              unidade={unidade}
              trigger={
                <Button variant="outline">
                  <Pencil className="mr-1 size-4" aria-hidden="true" /> Editar
                </Button>
              }
            />
            <ConfirmDelete
              titulo="Desativar unidade"
              descricao="A unidade sai do cadastro e as suas licenças deixam de contar nos painéis e relatórios. O histórico é preservado."
              rotuloConfirmar="Desativar"
              mensagemSucesso="Unidade desativada"
              onConfirm={() => deleteUnidade({ data: { id } })}
              onDone={() => {
                invalidarDados(qc);
                void navegar({ to: "/unidades" });
              }}
              trigger={
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  Desativar
                </Button>
              }
            />
          </>
        }
      />

      {unidade.observacoes && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {unidade.observacoes}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">
            Licenças e alvarás
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {licencas.length}
            </span>
          </CardTitle>
          <LicencaForm
            unidadeId={unidade.id}
            trigger={
              <Button size="sm">
                <Plus className="mr-1 size-4" aria-hidden="true" /> Nova licença
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="p-0">
          {licencas.length === 0 ? (
            <EmptyState
              titulo="Nenhuma licença registrada"
              descricao="Cadastre as licenças desta unidade por órgão e atividade (CNAE) para acompanhar prazos."
              acao={
                <LicencaForm
                  unidadeId={unidade.id}
                  trigger={
                    <Button size="sm">
                      <Plus className="mr-1 size-4" aria-hidden="true" /> Nova licença
                    </Button>
                  }
                />
              }
            />
          ) : (
            <TableScroll>
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Órgão</th>
                    <th className="p-3 font-medium">CNAE / atividade</th>
                    <th className="p-3 font-medium">Situação</th>
                    <th className="p-3 font-medium">Nº</th>
                    <th className="p-3 font-medium">Emissão</th>
                    <th className="p-3 font-medium">Vencimento</th>
                    <th className="p-3 font-medium">SEI</th>
                    <th className="p-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {licencas.map((l) => (
                    <LicencaRow
                      key={l.id}
                      licenca={l}
                      unidadeId={unidade.id}
                      documentos={documentos.filter(
                        (d) => d.licenca_id === l.id && d.ativo !== false,
                      )}
                      onChange={invalidar}
                    />
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </CardContent>
      </Card>

      <CnaesCard unidadeId={unidade.id} cnaes={cnaes} onChange={invalidar} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="size-4" aria-hidden="true" /> Responsáveis técnicos
              <span className="text-xs font-normal text-muted-foreground">
                {responsaveis.length}
              </span>
            </CardTitle>
            <RTForm
              unidadeId={unidade.id}
              trigger={
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 size-4" aria-hidden="true" /> Novo RT
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {responsaveis.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.conselho, r.numero_registro].filter(Boolean).join(" ") || "Sem registro"}
                    {r.cargo ? ` • ${r.cargo}` : ""}
                  </div>
                  {r.email && (
                    <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <RTForm
                    unidadeId={unidade.id}
                    responsavel={r}
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${r.nome}`}
                        title="Editar"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <ConfirmDelete
                    titulo="Excluir responsável técnico"
                    descricao={`${r.nome} deixa de constar nesta unidade. Esta ação não pode ser desfeita.`}
                    mensagemSucesso="Responsável excluído"
                    onConfirm={() => deleteRT({ data: { id: r.id } })}
                    onDone={invalidar}
                  />
                </div>
              </div>
            ))}
            {responsaveis.length === 0 && (
              <EmptyState
                compacto
                titulo="Nenhum responsável técnico"
                descricao="O Termo de Responsabilidade Técnica é exigido pela Vigilância Sanitária."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden="true" /> Documentos gerais
              <span className="text-xs font-normal text-muted-foreground">{docsGerais.length}</span>
            </CardTitle>
            <UploadDoc unidadeId={unidade.id} />
          </CardHeader>
          <CardContent className="space-y-2">
            {docsGerais.map((d) => (
              <DocRow key={d.id} documento={d} unidadeId={unidade.id} onChange={invalidar} />
            ))}
            {docsGerais.length === 0 && (
              <EmptyState
                compacto
                titulo="Sem documentos gerais"
                descricao="Anexe CNPJ, PGRSS, projeto aprovado e contratos de terceirização."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DadosUnidade({ unidade }: { unidade: Unidade }) {
  const itens = [
    { rotulo: "Nº IGES", valor: unidade.numero_iges?.toString() },
    { rotulo: "Tipo", valor: tipoUnidadeLabel(unidade.tipo) },
    { rotulo: "CNPJ", valor: unidade.cnpj },
    { rotulo: "CF/DF", valor: unidade.cf_df },
    { rotulo: "SEI", valor: unidade.processo_sei },
    { rotulo: "Edificação", valor: situacaoEdificacaoLabel(unidade.situacao_edificacao) },
    { rotulo: "Região", valor: unidade.regiao_administrativa },
  ].filter((i) => i.valor && i.valor !== "—");

  return (
    <span className="block space-y-1.5">
      <span className="flex flex-wrap gap-x-4 gap-y-1">
        {itens.map((i) => (
          <span key={i.rotulo}>
            <span className="text-muted-foreground">{i.rotulo}: </span>
            <span className="font-medium text-foreground">{i.valor}</span>
          </span>
        ))}
      </span>
      {unidade.endereco && <span className="block max-w-2xl">{unidade.endereco}</span>}
    </span>
  );
}

function LicencaRow({
  licenca,
  unidadeId,
  documentos,
  onChange,
}: {
  licenca: Licenca;
  unidadeId: string;
  documentos: Documento[];
  onChange: () => void;
}) {
  const [checklistAberto, setChecklistAberto] = useState(false);
  const cnae = parseCnae(licenca.descricao);

  return (
    <>
      <tr className="border-b hover:bg-muted/30">
        <td className="p-3 align-top">
          <div className="font-medium whitespace-nowrap">{orgaoLabel(licenca.orgao)}</div>
          <div className="max-w-48 text-xs text-muted-foreground">
            {orgaoDescricao(licenca.orgao)}
          </div>
        </td>
        <td className="p-3 align-top">
          {cnae.codigo ? (
            <>
              <div className="font-mono text-xs font-medium whitespace-nowrap">{cnae.codigo}</div>
              <div
                className="max-w-xs truncate text-xs text-muted-foreground"
                title={cnae.label ?? undefined}
              >
                {cnae.label ?? "—"}
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{cnae.label ?? "—"}</span>
          )}
        </td>
        <td className="p-3 align-top">
          <SemaforoBadge licenca={licenca} />
          <div className="mt-1 text-[11px] text-muted-foreground">
            {statusLabel(licenca.status)}
          </div>
        </td>
        <td className="p-3 align-top text-xs">{licenca.numero ?? "—"}</td>
        <td className="p-3 align-top whitespace-nowrap">{formatDate(licenca.data_emissao)}</td>
        <td className="p-3 align-top whitespace-nowrap">{formatDate(licenca.data_vencimento)}</td>
        <td className="p-3 align-top text-xs">{licenca.processo_sei ?? "—"}</td>
        <td className="space-x-1 p-3 text-right align-top whitespace-nowrap">
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={checklistAberto}
            aria-label={checklistAberto ? "Fechar checklist" : "Abrir checklist do processo"}
            title="Checklist do processo"
            onClick={() => setChecklistAberto((v) => !v)}
          >
            <ListChecks className="size-4" aria-hidden="true" />
          </Button>
          <DocsLicenca
            licencaId={licenca.id}
            unidadeId={unidadeId}
            documentos={documentos}
            onChange={onChange}
          />
          <LicencaForm
            licenca={licenca}
            unidadeId={unidadeId}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar licença ${orgaoLabel(licenca.orgao)}`}
                title="Editar"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
            }
          />
          <ConfirmDelete
            titulo="Excluir licença"
            descricao="O registro e o checklist associado são removidos definitivamente."
            mensagemSucesso="Licença excluída"
            onConfirm={() => deleteLicenca({ data: { id: licenca.id } })}
            onDone={onChange}
          />
        </td>
      </tr>
      {checklistAberto && (
        <tr className="border-b bg-muted/20">
          <td colSpan={8} className="p-4">
            <ChecklistInline licencaId={licenca.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function CnaesCard({
  unidadeId,
  cnaes,
  onChange,
}: {
  unidadeId: string;
  cnaes: CnaeUnidade[];
  onChange: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">
          CNAEs sanitários (VISADF)
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{cnaes.length}</span>
        </CardTitle>
        <CnaeForm
          unidadeId={unidadeId}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="mr-1 size-4" aria-hidden="true" /> Novo CNAE
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="p-0">
        {cnaes.length === 0 ? (
          <EmptyState
            compacto
            titulo="Nenhum CNAE cadastrado"
            descricao="Cadastre as atividades econômicas declaradas à Vigilância Sanitária."
          />
        ) : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Código</th>
                  <th className="p-3 font-medium">Descrição</th>
                  <th className="p-3 font-medium">CNPJ SES-DF (legado)</th>
                  <th className="p-3 font-medium">Situação</th>
                  <th className="p-3 font-medium">Vencimento</th>
                  <th className="p-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cnaes.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs whitespace-nowrap">{c.codigo}</td>
                    <td className="p-3 text-xs">{c.descricao}</td>
                    <td className="p-3 text-xs">{c.cnpj_ses_legado ?? "—"}</td>
                    <td className="p-3">
                      <SemaforoBadge
                        licenca={{ status: c.status, data_vencimento: c.data_vencimento }}
                      />
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {formatDate(c.data_vencimento)}
                    </td>
                    <td className="space-x-1 p-3 text-right whitespace-nowrap">
                      <CnaeForm
                        unidadeId={unidadeId}
                        cnae={c}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar CNAE ${c.codigo}`}
                            title="Editar"
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                        }
                      />
                      <ConfirmDelete
                        titulo={`Excluir CNAE ${c.codigo}`}
                        descricao="A atividade deixa de constar nesta unidade. Esta ação não pode ser desfeita."
                        mensagemSucesso="CNAE excluído"
                        onConfirm={() => deleteCnae({ data: { id: c.id } })}
                        onDone={onChange}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </CardContent>
    </Card>
  );
}
