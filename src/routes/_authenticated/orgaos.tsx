import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Landmark, Mail, MapPin, Pencil, Phone, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/states";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Field, FieldRow, FormSheet } from "@/components/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteOrgao, upsertOrgao } from "@/lib/orgaos.functions";
import { invalidarDados, orgaosQuery } from "@/lib/queries";
import { mensagemErro } from "@/lib/errors";
import type { Orgao_ } from "@/lib/rows";

export const Route = createFileRoute("/_authenticated/orgaos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orgaosQuery),
  component: OrgaosPage,
  pendingComponent: () => <CardGridSkeleton itens={6} />,
  head: () => ({
    meta: [
      { title: "Órgãos — IGESDF Compliance" },
      {
        name: "description",
        content:
          "Cadastro dos órgãos licenciadores utilizados pelo IGESDF: DF LEGAL, SUSDEC, CBMDF, IBRAM, VISADF, PCDF, SEAGRI e SEEDF.",
      },
      { property: "og:title", content: "Órgãos licenciadores — IGESDF" },
      {
        property: "og:description",
        content: "Órgãos oficiais envolvidos no licenciamento das unidades do IGESDF.",
      },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/orgaos" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/orgaos" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function OrgaosPage() {
  const { data } = useSuspenseQuery(orgaosQuery);
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return data;
    return data.filter((o) =>
      [o.sigla, o.nome, o.categoria].filter(Boolean).join(" ").toLowerCase().includes(termo),
    );
  }, [data, busca]);

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Órgãos reguladores"
        descricao={
          busca
            ? `${filtrados.length} de ${data.length} órgãos.`
            : `${data.length} órgãos cadastrados.`
        }
        acoes={
          <OrgaoForm
            trigger={
              <Button>
                <Plus className="mr-1 size-4" aria-hidden="true" /> Novo órgão
              </Button>
            }
          />
        }
      />

      <div className="relative max-w-md">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Buscar por sigla, nome ou categoria…"
          aria-label="Buscar órgãos"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icone={<Landmark className="size-5" aria-hidden="true" />}
              titulo={data.length === 0 ? "Nenhum órgão cadastrado" : "Nenhum órgão encontrado"}
              descricao={
                data.length === 0
                  ? "Cadastre os órgãos licenciadores com contatos e sites para consulta rápida."
                  : "Tente outra sigla ou nome."
              }
              acao={
                data.length === 0 ? (
                  <OrgaoForm
                    trigger={
                      <Button size="sm">
                        <Plus className="mr-1 size-4" aria-hidden="true" /> Novo órgão
                      </Button>
                    }
                  />
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setBusca("")}>
                    Limpar busca
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((o) => (
            <OrgaoCard key={o.id} orgao={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgaoCard({ orgao }: { orgao: Orgao_ }) {
  const qc = useQueryClient();
  const site = orgao.site?.startsWith("http")
    ? orgao.site
    : orgao.site
      ? `https://${orgao.site}`
      : null;

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {orgao.sigla}
              </Badge>
              {orgao.ativo === false && (
                <Badge variant="outline" className="text-muted-foreground">
                  Inativo
                </Badge>
              )}
            </div>
            <div className="mt-1 leading-tight font-medium">{orgao.nome}</div>
            {orgao.categoria && (
              <div className="mt-0.5 text-xs text-muted-foreground">{orgao.categoria}</div>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <OrgaoForm
              orgao={orgao}
              trigger={
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar ${orgao.sigla}`}
                  title="Editar"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <ConfirmDelete
              titulo={`Excluir ${orgao.sigla}?`}
              descricao="Esta ação é permanente. Só é possível se não houver licenças associadas a este órgão."
              mensagemSucesso="Órgão excluído"
              onConfirm={() => deleteOrgao({ data: { id: orgao.id } })}
              onDone={() => invalidarDados(qc)}
            />
          </div>
        </div>

        <div className="flex-1 space-y-1 text-xs text-muted-foreground">
          {site && (
            <div className="flex items-center gap-1.5">
              <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
              <a href={site} target="_blank" rel="noreferrer" className="truncate underline">
                {orgao.site}
              </a>
            </div>
          )}
          {orgao.telefone && (
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 shrink-0" aria-hidden="true" />
              <span>{orgao.telefone}</span>
            </div>
          )}
          {orgao.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="size-3 shrink-0" aria-hidden="true" />
              <a href={`mailto:${orgao.email}`} className="truncate underline">
                {orgao.email}
              </a>
            </div>
          )}
          {orgao.endereco && (
            <div className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>{orgao.endereco}</span>
            </div>
          )}
        </div>

        {orgao.observacoes && (
          <p className="border-t pt-2 text-xs text-muted-foreground italic">{orgao.observacoes}</p>
        )}
      </CardContent>
    </Card>
  );
}

type ValoresOrgao = {
  id?: string;
  sigla: string;
  nome: string;
  categoria: string;
  site: string;
  telefone: string;
  email: string;
  endereco: string;
  observacoes: string;
  ativo: boolean;
};

function OrgaoForm({ orgao, trigger }: { orgao?: Orgao_; trigger: ReactNode }) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: (valores: ValoresOrgao) => upsertOrgao({ data: valores }),
    onSuccess: () => {
      toast.success(orgao ? "Órgão atualizado" : "Órgão cadastrado");
      invalidarDados(qc);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<ValoresOrgao>
      titulo={orgao ? "Editar órgão" : "Novo órgão"}
      descricao="Contatos e site oficial para abrir e acompanhar processos."
      trigger={trigger}
      valorInicial={() => ({
        id: orgao?.id,
        sigla: orgao?.sigla ?? "",
        nome: orgao?.nome ?? "",
        categoria: orgao?.categoria ?? "",
        site: orgao?.site ?? "",
        telefone: orgao?.telefone ?? "",
        email: orgao?.email ?? "",
        endereco: orgao?.endereco ?? "",
        observacoes: orgao?.observacoes ?? "",
        ativo: orgao?.ativo ?? true,
      })}
      podeSalvar={(v) => v.sigla.trim().length >= 2 && v.nome.trim().length >= 2}
      onSubmit={(v) => salvar.mutateAsync(v)}
    >
      {(v, definir) => (
        <>
          <FieldRow>
            <Field label="Sigla" obrigatorio htmlFor="org-sigla">
              <Input
                id="org-sigla"
                required
                maxLength={30}
                value={v.sigla}
                onChange={(e) => definir("sigla", e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Categoria" htmlFor="org-categoria">
              <Input
                id="org-categoria"
                value={v.categoria}
                onChange={(e) => definir("categoria", e.target.value)}
                placeholder="Ex.: Vigilância sanitária"
              />
            </Field>
          </FieldRow>

          <Field label="Nome oficial" obrigatorio htmlFor="org-nome">
            <Input
              id="org-nome"
              required
              value={v.nome}
              onChange={(e) => definir("nome", e.target.value)}
            />
          </Field>

          <Field label="Site" htmlFor="org-site">
            <Input
              id="org-site"
              value={v.site}
              onChange={(e) => definir("site", e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <FieldRow>
            <Field label="Telefone" htmlFor="org-telefone">
              <Input
                id="org-telefone"
                inputMode="tel"
                value={v.telefone}
                onChange={(e) => definir("telefone", e.target.value)}
              />
            </Field>
            <Field label="E-mail" htmlFor="org-email">
              <Input
                id="org-email"
                type="email"
                value={v.email}
                onChange={(e) => definir("email", e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Endereço" htmlFor="org-endereco">
            <Input
              id="org-endereco"
              value={v.endereco}
              onChange={(e) => definir("endereco", e.target.value)}
            />
          </Field>

          <Field label="Observações" htmlFor="org-obs">
            <Textarea
              id="org-obs"
              rows={3}
              value={v.observacoes}
              onChange={(e) => definir("observacoes", e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-2">
            <Checkbox
              id="org-ativo"
              checked={v.ativo}
              onCheckedChange={(marcado) => definir("ativo", marcado === true)}
            />
            <Label htmlFor="org-ativo" className="text-sm font-normal">
              Órgão ativo
            </Label>
          </div>
        </>
      )}
    </FormSheet>
  );
}
