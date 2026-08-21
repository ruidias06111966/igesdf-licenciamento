import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Table2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { dadosConsolidado, registarDespachoGerado } from "@/lib/despachos.functions";
import { upsertModelo } from "@/lib/modelos.functions";
import { mensagemErro } from "@/lib/errors";
import { ORGAOS, TIPO_UNIDADE_LABEL, orgaoLabel, tipoUnidadeLabel } from "@/lib/domain";
import { competenciaLabel, csvDeQuadro } from "@/lib/despacho/nucleo";
import {
  montarConsolidado,
  resumirPorOrgao,
  resumirRede,
  type CamposConsolidado,
} from "@/lib/despacho/consolidado";
import { AcoesCopiar, FolhaDespacho, markdownDe } from "@/lib/despacho/folha";
import { SubNav } from "@/components/sub-nav";

export const Route = createFileRoute("/_authenticated/consolidado")({
  component: ConsolidadoPage,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
  head: () => ({
    meta: [
      { title: "Consolidado da Rede — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Despacho consolidado mensal ou trimestral do licenciamento de toda a rede IGESDF, com quadros por unidade e por órgão.",
      },
      { property: "og:title", content: "Consolidado da rede — IGESDF" },
      {
        property: "og:description",
        content: "Panorama do licenciamento da rede com pendências, vencidas e tempos de espera.",
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

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

/** Intervalo da competência: o mês escolhido, ou o trimestre que o contém. */
function intervalo(competencia: string, periodo: "mensal" | "trimestral") {
  const [ano, mes] = competencia.split("-").map(Number);
  const fimMes = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
  if (periodo === "mensal") {
    return { inicio: `${competencia}-01`, fim: fimMes };
  }
  const primeiro = Math.floor((mes - 1) / 3) * 3 + 1;
  const ultimo = primeiro + 2;
  return {
    inicio: `${ano}-${String(primeiro).padStart(2, "0")}-01`,
    fim: new Date(Date.UTC(ano, ultimo, 0)).toISOString().slice(0, 10),
  };
}

function ConsolidadoPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["consolidado-rede"],
    queryFn: () => dadosConsolidado(),
  });

  const [tipo, setTipo] = useState("todos");
  const [orgao, setOrgao] = useState("todos");
  const [campos, setCampos] = useState<CamposConsolidado>({
    numero: "",
    processo_sei: "",
    destinatario: "",
    competencia: mesAtual(),
    periodo: "mensal",
    limiteEspera: 60,
    observacoes: "",
    local: "",
    assinantes: ASSINANTES_PADRAO,
    secoes: { quadro: true, orgaos: true, espera: true, conferencia: true },
  });

  const definir = <K extends keyof CamposConsolidado>(k: K, v: CamposConsolidado[K]) =>
    setCampos((c) => ({ ...c, [k]: v }));

  const { resumos, porOrgao } = useMemo(() => {
    if (!data) return { resumos: [], porOrgao: [] };
    const unidades = data.unidades.filter((u) => tipo === "todos" || u.tipo === tipo);
    const idsVisiveis = new Set(unidades.map((u) => u.id));
    const licencas = data.licencas.filter(
      (l) => idsVisiveis.has(l.unidade_id) && (orgao === "todos" || l.orgao === orgao),
    );
    return {
      resumos: resumirRede(unidades, licencas, intervalo(campos.competencia, campos.periodo)),
      porOrgao: resumirPorOrgao(licencas),
    };
  }, [data, tipo, orgao, campos.competencia, campos.periodo]);

  const blocos = useMemo(
    () => (data ? montarConsolidado({ resumos, porOrgao, campos }) : []),
    [data, resumos, porOrgao, campos],
  );

  const guardar = useMutation({
    mutationFn: async () => {
      await upsertModelo({
        data: {
          titulo: `Consolidado da rede — ${competenciaLabel(campos.competencia)}`,
          tipo: "relatorio",
          conteudo: markdownDe(blocos),
          tags: ["consolidado", "licenciamento", campos.periodo],
        },
      });
      await registarDespachoGerado({
        data: {
          tipo: "consolidado",
          competencia: campos.competencia,
          periodo: campos.periodo,
          unidades: resumos.length,
        },
      });
    },
    onSuccess: () => toast.success("Consolidado guardado na biblioteca de modelos"),
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const exportarCsv = () => {
    const csv = csvDeQuadro(
      ["Unidade", "Tipo", "Total", "Licenciadas", "Dispensadas", "Pendentes", "Vencidas", "Última atualização"],
      resumos.map((r) => [
        r.unidade.nome_fantasia?.trim() || r.unidade.nome,
        tipoUnidadeLabel(r.unidade.tipo),
        String(r.total),
        String(r.licenciadas),
        String(r.dispensadas),
        String(r.pendentes),
        String(r.vencidas),
        r.ultimaAtualizacao ?? "",
      ]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `consolidado-${campos.competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Consolidado da Rede"
        descricao="Despacho mensal ou trimestral do licenciamento de todas as unidades."
        acoes={<PrintModeToggle defaultOrientation="portrait" />}
      />
      <SubNav grupo="relatorios" />

      {isLoading && <p className="text-sm text-muted-foreground">A carregar a rede…</p>}
      {error && <ErrorState error={error} />}

      {data && (
        <>
          <Card className="no-print">
            <CardContent className="grid gap-4 p-4 md:grid-cols-3">
              <div>
                <Label htmlFor="cons-comp" className="text-xs">
                  Competência
                </Label>
                <Input
                  id="cons-comp"
                  type="month"
                  className="mt-1"
                  value={campos.competencia}
                  onChange={(e) => definir("competencia", e.target.value || mesAtual())}
                />
              </div>
              <div>
                <Label htmlFor="cons-periodo" className="text-xs">
                  Período
                </Label>
                <Select
                  value={campos.periodo}
                  onValueChange={(v) => definir("periodo", v as "mensal" | "trimestral")}
                >
                  <SelectTrigger id="cons-periodo" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cons-limite" className="text-xs">
                  Espera destacada a partir de (dias)
                </Label>
                <Input
                  id="cons-limite"
                  type="number"
                  min={1}
                  className="mt-1"
                  value={campos.limiteEspera}
                  onChange={(e) => definir("limiteEspera", Number(e.target.value) || 60)}
                />
              </div>
              <div>
                <Label htmlFor="cons-tipo" className="text-xs">
                  Tipo de unidade
                </Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="cons-tipo" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {Object.entries(TIPO_UNIDADE_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cons-orgao" className="text-xs">
                  Órgão
                </Label>
                <Select value={orgao} onValueChange={setOrgao}>
                  <SelectTrigger id="cons-orgao" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {ORGAOS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {orgaoLabel(o.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Secções</Label>
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      ["quadro", "Quadro por unidade"],
                      ["orgaos", "Por órgão"],
                      ["espera", "Tempos de espera"],
                      ["conferencia", "Conferência"],
                    ] as const
                  ).map(([chave, rotulo]) => (
                    <label key={chave} className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={campos.secoes[chave]}
                        onCheckedChange={(m) =>
                          definir("secoes", { ...campos.secoes, [chave]: m === true })
                        }
                      />
                      {rotulo}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="cons-num" className="text-xs">
                  Número do despacho
                </Label>
                <Input
                  id="cons-num"
                  className="mt-1"
                  value={campos.numero}
                  onChange={(e) => definir("numero", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cons-sei" className="text-xs">
                  Processo SEI
                </Label>
                <Input
                  id="cons-sei"
                  className="mt-1"
                  value={campos.processo_sei}
                  onChange={(e) => definir("processo_sei", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cons-dest" className="text-xs">
                  Destinatário
                </Label>
                <Input
                  id="cons-dest"
                  className="mt-1"
                  value={campos.destinatario}
                  onChange={(e) => definir("destinatario", e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <Label htmlFor="cons-obs" className="text-xs">
                  Observações e encaminhamentos (uma por linha)
                </Label>
                <Textarea
                  id="cons-obs"
                  rows={3}
                  className="mt-1"
                  value={campos.observacoes}
                  onChange={(e) => definir("observacoes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <AcoesCopiar
              blocos={blocos}
              ficheiro={`consolidado-rede-${campos.competencia}`}
              rodape={`Consolidado da rede — ${competenciaLabel(campos.competencia)} — ${resumos.length} unidades`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="no-print"
              onClick={exportarCsv}
            >
              <Table2 className="mr-1 size-3.5" aria-hidden="true" /> Exportar quadro (CSV)
            </Button>
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
        </>
      )}
    </div>
  );
}
