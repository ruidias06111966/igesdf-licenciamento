import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { unidadesQuery, invalidarDados } from "@/lib/queries";
import { dadosDespachoUnidade } from "@/lib/despachos.functions";
import { upsertLicenca } from "@/lib/licencas.functions";
import { upsertModelo } from "@/lib/modelos.functions";
import { mensagemErro } from "@/lib/errors";
import { parseCnae, orgaoLabel, type Orgao, type StatusLicenca } from "@/lib/domain";
import {
  CLASSE_LABEL,
  SITUACAO_LABEL,
  classificar,
  paraStatus,
  type Classe,
  type ItemDespacho,
  type Situacao,
} from "@/lib/despacho/nucleo";
import { montarDespachoUnidade, type CamposDespacho } from "@/lib/despacho/unidade";
import { AcoesCopiar, FolhaDespacho, markdownDe } from "@/lib/despacho/folha";

export const Route = createFileRoute("/_authenticated/despachos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(unidadesQuery),
  component: DespachosPage,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
  head: () => ({
    meta: [
      { title: "Despachos — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Gerador de despachos de licenciamento por unidade, com CNAEs, situação por órgão e validades vindas da base.",
      },
      { property: "og:title", content: "Despachos de licenciamento — IGESDF" },
      {
        property: "og:description",
        content: "Monta o despacho da unidade a partir das licenças registadas no sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ASSINANTES_PADRAO = [
  { nome: "Rui José Lopes Dias", cargo: "Núcleo de Conformidade — NUCON/IGESDF" },
  { nome: "Paulo Ricardo Oliveira Lima", cargo: "Gerência de Conformidade — IGESDF" },
];

function DespachosPage() {
  const { data: unidades } = useSuspenseQuery(unidadesQuery);
  const [unidadeId, setUnidadeId] = useState("");

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Despachos"
        descricao="Despacho de licenciamento por unidade, pré-preenchido com os dados do sistema."
        acoes={<PrintModeToggle defaultOrientation="portrait" />}
      />

      <Card className="no-print">
        <CardContent className="p-4">
          <Label htmlFor="desp-unidade" className="text-xs">
            Unidade
          </Label>
          <Select value={unidadeId} onValueChange={setUnidadeId}>
            <SelectTrigger id="desp-unidade" className="mt-1 max-w-xl">
              <SelectValue placeholder="Escolher unidade…" />
            </SelectTrigger>
            <SelectContent>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {unidadeId ? (
        <Editor key={unidadeId} unidadeId={unidadeId} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Escolha a unidade para o sistema montar o despacho.
        </p>
      )}
    </div>
  );
}

type ItemEditavel = ItemDespacho & { descricao_original: string | null; unidade_id: string };

function Editor({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["despacho-unidade", unidadeId],
    queryFn: () => dadosDespachoUnidade({ data: { unidade_id: unidadeId } }),
  });

  const [itens, setItens] = useState<ItemEditavel[] | null>(null);
  const [campos, setCampos] = useState<CamposDespacho>({
    numero: "",
    processo_sei: "",
    destinatario: "",
    assunto: "",
    certificado_data: "",
    certificado_codigo: "",
    area_m2: "",
    restricao_viabilidade: "",
    providencias: "",
    local: "",
    assinantes: ASSINANTES_PADRAO,
  });

  const iniciais = useMemo<ItemEditavel[]>(() => {
    if (!data) return [];
    return (data.licencas ?? []).map((l) => {
      const { classe, situacao } = classificar(l.status as StatusLicenca);
      const cnae = parseCnae(l.descricao);
      return {
        licenca_id: l.id,
        unidade_id: unidadeId,
        orgao: l.orgao as Orgao,
        cnae: cnae.codigo ?? "",
        cnae_desc: cnae.label ?? l.descricao ?? "",
        descricao_original: l.descricao,
        classe,
        situacao,
        validade: l.data_vencimento,
        status: l.status as StatusLicenca,
        atualizado_em: l.updated_at,
      };
    });
  }, [data, unidadeId]);

  const lista = itens ?? iniciais;

  const blocos = useMemo(() => {
    if (!data) return [];
    return montarDespachoUnidade({
      unidade: data.unidade,
      itens: lista,
      campos: {
        ...campos,
        processo_sei: campos.processo_sei || (data.processos[0]?.numero ?? ""),
      },
    });
  }, [data, lista, campos]);

  const alterados = useMemo(
    () =>
      lista.filter((i, idx) => {
        const o = iniciais[idx];
        return o && (paraStatus(i) !== o.status || i.validade !== o.validade);
      }),
    [lista, iniciais],
  );

  const aplicar = useMutation({
    mutationFn: async () => {
      for (const i of alterados) {
        if (!i.licenca_id) continue;
        await upsertLicenca({
          data: {
            id: i.licenca_id,
            unidade_id: i.unidade_id,
            orgao: i.orgao,
            descricao: i.descricao_original,
            status: paraStatus(i),
            data_vencimento: i.validade,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(`${alterados.length} licença(s) atualizada(s)`);
      setItens(null);
      invalidarDados(qc);
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const guardar = useMutation({
    mutationFn: () =>
      upsertModelo({
        data: {
          titulo: `Despacho — ${data?.unidade.nome ?? "unidade"}${campos.numero ? ` nº ${campos.numero}` : ""}`,
          tipo: "despacho",
          conteudo: markdownDe(blocos),
          tags: ["despacho", "licenciamento"],
          unidade_id: unidadeId,
        },
      }),
    onSuccess: () => toast.success("Despacho guardado na biblioteca de modelos"),
    onError: (e) => toast.error(mensagemErro(e)),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">A carregar dados…</p>;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const definir = <K extends keyof CamposDespacho>(k: K, v: CamposDespacho[K]) =>
    setCampos((c) => ({ ...c, [k]: v }));

  const atualizarItem = (idx: number, patch: Partial<ItemEditavel>) =>
    setItens(lista.map((i, j) => (j === idx ? { ...i, ...patch } : i)));

  return (
    <div className="space-y-5">
      <Card className="no-print">
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Campo label="Número do despacho" valor={campos.numero} ao={(v) => definir("numero", v)} />
          <Campo
            label="Processo SEI"
            valor={campos.processo_sei}
            ao={(v) => definir("processo_sei", v)}
            dica={data.processos[0]?.numero ?? undefined}
          />
          <Campo
            label="Destinatário"
            valor={campos.destinatario}
            ao={(v) => definir("destinatario", v)}
          />
          <Campo label="Assunto" valor={campos.assunto} ao={(v) => definir("assunto", v)} />
          <Campo
            label="Data do certificado"
            tipo="date"
            valor={campos.certificado_data}
            ao={(v) => definir("certificado_data", v)}
          />
          <Campo
            label="Código de validação"
            valor={campos.certificado_codigo}
            ao={(v) => definir("certificado_codigo", v)}
          />
          <Campo label="Área (m²)" valor={campos.area_m2} ao={(v) => definir("area_m2", v)} />
          <Campo label="Local e data" valor={campos.local} ao={(v) => definir("local", v)} />
          <div className="md:col-span-2">
            <Label htmlFor="desp-viab" className="text-xs">
              Viabilidade / restrições
            </Label>
            <Textarea
              id="desp-viab"
              rows={2}
              className="mt-1"
              value={campos.restricao_viabilidade}
              onChange={(e) => definir("restricao_viabilidade", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="desp-prov" className="text-xs">
              Providências (uma por linha)
            </Label>
            <Textarea
              id="desp-prov"
              rows={4}
              className="mt-1"
              value={campos.providencias}
              onChange={(e) => definir("providencias", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Situação por órgão e CNAE ({lista.length})</h2>
            <Button
              size="sm"
              disabled={alterados.length === 0 || aplicar.isPending}
              onClick={() => aplicar.mutate()}
            >
              <Wand2 className="mr-1 size-3.5" aria-hidden="true" />
              {aplicar.isPending
                ? "A gravar…"
                : `Aplicar alterações às licenças (${alterados.length})`}
            </Button>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Órgão</th>
                  <th className="px-2 py-1 text-left">CNAE</th>
                  <th className="px-2 py-1 text-left">Classificação</th>
                  <th className="px-2 py-1 text-left">Situação</th>
                  <th className="px-2 py-1 text-left">Validade</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i, idx) => (
                  <tr key={i.licenca_id ?? idx} className="border-t">
                    <td className="px-2 py-1 whitespace-nowrap">{orgaoLabel(i.orgao)}</td>
                    <td className="px-2 py-1">
                      <span className="font-mono">{i.cnae || "—"}</span>
                      <span className="ml-1 text-muted-foreground">{i.cnae_desc}</span>
                    </td>
                    <td className="px-2 py-1">
                      <select
                        aria-label="Classificação"
                        className="w-full rounded border bg-background px-1 py-0.5"
                        value={i.classe}
                        onChange={(e) =>
                          atualizarItem(idx, { classe: e.target.value as Classe })
                        }
                      >
                        {(Object.keys(CLASSE_LABEL) as Classe[]).map((c) => (
                          <option key={c} value={c}>
                            {CLASSE_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select
                        aria-label="Situação"
                        className="w-full rounded border bg-background px-1 py-0.5"
                        value={i.situacao}
                        disabled={i.classe !== "nao_licenciada"}
                        onChange={(e) =>
                          atualizarItem(idx, { situacao: e.target.value as Situacao })
                        }
                      >
                        <option value="">—</option>
                        {(Object.keys(SITUACAO_LABEL) as Exclude<Situacao, "">[]).map((s) => (
                          <option key={s} value={s}>
                            {SITUACAO_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="date"
                        aria-label="Validade"
                        className="rounded border bg-background px-1 py-0.5"
                        value={i.validade ?? ""}
                        onChange={(e) => atualizarItem(idx, { validade: e.target.value || null })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <AcoesCopiar blocos={blocos} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="no-print"
          disabled={guardar.isPending}
          onClick={() => guardar.mutate()}
        >
          <Save className="mr-1 size-3.5" aria-hidden="true" /> Guardar na biblioteca
        </Button>
      </div>

      <FolhaDespacho blocos={blocos} />
    </div>
  );
}

function Campo({
  label,
  valor,
  ao,
  tipo,
  dica,
}: {
  label: string;
  valor: string;
  ao: (v: string) => void;
  tipo?: string;
  dica?: string;
}) {
  const id = `campo-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={tipo}
        className="mt-1"
        value={valor}
        placeholder={dica}
        onChange={(e) => ao(e.target.value)}
      />
    </div>
  );
}
