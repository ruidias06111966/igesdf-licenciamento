import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableScroll } from "@/components/data-table";
import { usePodeEditar } from "@/lib/perfil";
import { chaves } from "@/lib/queries";
import { mensagemErro } from "@/lib/errors";
import { orgaoLabel, statusLabel } from "@/lib/domain";
import { baixarCsv, sufixoData } from "@/lib/csv";
import { dataIso, normalizarCabecalho, parseCsv } from "@/lib/csv-parse";
import {
  COLUNAS_CSV,
  linhaImportacaoSchema,
  ORGAOS_IMPORT,
  STATUS_IMPORT,
  type LinhaImportacao,
} from "@/lib/importacao-schema";
import { importarLicencas, type ResultadoLinha } from "@/lib/importacao.functions";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [
      { title: "Importar licenças — IGESDF Licenciamento" },
      {
        name: "description",
        content:
          "Carga de licenças por planilha CSV com pré-visualização das alterações antes de gravar.",
      },
      { property: "og:title", content: "Importar licenças — IGESDF Licenciamento" },
      {
        property: "og:description",
        content: "Atualize licenças em massa a partir de uma planilha, com conferência prévia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Importar,
  errorComponent: ({ error }) => <ErrorState error={error} />,
});

type LinhaLida = { numero: number; linha?: LinhaImportacao; erro?: string };

const MODELO = [
  {
    unidade: "UPA de Brazlândia",
    orgao: "VISA",
    descricao: "8610-1/02 — Atividades de UPA",
    numero: "",
    processo_sei: "",
    status: "vigente",
    data_emissao: "2026-01-15",
    data_vencimento: "2027-01-14",
    observacoes: "",
  },
];

function lerFicheiro(texto: string): LinhaLida[] {
  const tabela = parseCsv(texto);
  if (tabela.length < 2) return [];
  const cabecalho = (tabela[0] ?? []).map((c) => COLUNAS_CSV[normalizarCabecalho(c)]);
  return tabela.slice(1).map((colunas, i) => {
    const bruto: Record<string, string> = {};
    cabecalho.forEach((campo, col) => {
      if (!campo) return;
      const valor = (colunas[col] ?? "").trim();
      if (!valor) return;
      bruto[campo] = campo.startsWith("data_") ? (dataIso(valor) ?? valor) : valor;
    });
    const resultado = linhaImportacaoSchema.safeParse(bruto);
    if (!resultado.success) {
      return {
        numero: i + 2,
        erro: resultado.error.issues.map((p) => `${p.path.join(".")}: ${p.message}`).join("; "),
      };
    }
    return { numero: i + 2, linha: resultado.data };
  });
}

function Importar() {
  const podeEditar = usePodeEditar();
  const qc = useQueryClient();
  const [lidas, setLidas] = useState<LinhaLida[]>([]);
  const [nomeFicheiro, setNomeFicheiro] = useState("");
  const [resultados, setResultados] = useState<ResultadoLinha[] | null>(null);
  const [aplicado, setAplicado] = useState(false);

  const validas = useMemo(
    () => lidas.filter((l): l is Required<Pick<LinhaLida, "linha">> & LinhaLida => !!l.linha),
    [lidas],
  );
  const invalidas = lidas.filter((l) => l.erro);

  const executar = useMutation({
    mutationFn: (aplicar: boolean) =>
      importarLicencas({ data: { linhas: validas.map((l) => l.linha), aplicar } }),
    onSuccess: (r) => {
      setResultados(r.resultados);
      setAplicado(r.aplicado);
      if (r.aplicado) {
        toast.success(
          `Importação concluída: ${r.resumo.criar} criadas, ${r.resumo.atualizar} atualizadas.`,
        );
        void qc.invalidateQueries({ queryKey: chaves.licencas });
      } else {
        toast.success("Pré-visualização pronta. Confira antes de gravar.");
      }
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const carregar = async (ficheiro: File) => {
    const texto = await ficheiro.text();
    setNomeFicheiro(ficheiro.name);
    setResultados(null);
    setAplicado(false);
    const linhas = lerFicheiro(texto);
    setLidas(linhas);
    if (linhas.length === 0) toast.error("Não foi possível ler linhas neste ficheiro.");
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        titulo="Importar licenças"
        descricao="Atualize várias licenças de uma vez a partir de uma planilha CSV, com conferência antes de gravar."
        migalhas={[{ label: "Início", to: "/dashboard" }, { label: "Importar" }]}
        acoes={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              baixarCsv(
                `modelo-importacao-licencas-${sufixoData()}`,
                MODELO,
                Object.keys(MODELO[0]!).map((k) => ({
                  cabecalho: k,
                  valor: (l) => (l as Record<string, string>)[k] ?? "",
                })),
              )
            }
          >
            <Download className="mr-1 size-3.5" aria-hidden="true" /> Modelo CSV
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Escolher o ficheiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Ficheiro CSV de licenças"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void carregar(f);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Colunas reconhecidas: unidade, órgão, cnae/descrição, número, processo SEI, estado,
            emissão, vencimento, protocolo e observações. Órgãos aceites:{" "}
            {ORGAOS_IMPORT.map((o) => orgaoLabel(o)).join(", ")}. Estados aceites:{" "}
            {STATUS_IMPORT.map((s) => statusLabel(s)).join(", ")}. A unidade é identificada pelo
            nome, CNPJ ou número IGES; a licença é reconhecida pela combinação unidade + órgão +
            CNAE. Campos vazios não apagam o que já está gravado.
          </p>
          {nomeFicheiro && (
            <p className="text-xs">
              <span className="font-medium">{nomeFicheiro}</span> — {validas.length} linha(s)
              válida(s)
              {invalidas.length > 0 && `, ${invalidas.length} com erro`}.
            </p>
          )}
        </CardContent>
      </Card>

      {invalidas.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Linhas com erro de preenchimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {invalidas.slice(0, 30).map((l) => (
              <p key={l.numero}>
                <span className="font-medium">Linha {l.numero}:</span> {l.erro}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {validas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Conferir e gravar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={executar.isPending}
                onClick={() => executar.mutate(false)}
              >
                Pré-visualizar alterações
              </Button>
              <Button
                size="sm"
                disabled={!podeEditar || executar.isPending || !resultados || aplicado}
                onClick={() => executar.mutate(true)}
              >
                <Upload className="mr-1 size-3.5" aria-hidden="true" /> Gravar importação
              </Button>
            </div>
            {!podeEditar && (
              <p className="text-xs text-muted-foreground">
                O acesso de consulta permite pré-visualizar, mas não gravar.
              </p>
            )}
            {resultados && (
              <TableScroll>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Linha</th>
                      <th className="p-2">Ação</th>
                      <th className="p-2">Unidade</th>
                      <th className="p-2">Órgão</th>
                      <th className="p-2">CNAE / descrição</th>
                      <th className="p-2">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((r) => (
                      <tr key={r.linha} className="border-b last:border-0">
                        <td className="p-2">{r.linha}</td>
                        <td className="p-2">
                          <Badge
                            variant={
                              r.acao === "erro"
                                ? "destructive"
                                : r.acao === "ignorar"
                                  ? "outline"
                                  : "secondary"
                            }
                            className="text-[10px] capitalize"
                          >
                            {r.acao}
                          </Badge>
                        </td>
                        <td className="p-2">{r.unidade ?? "—"}</td>
                        <td className="p-2">{r.orgao ? orgaoLabel(r.orgao) : "—"}</td>
                        <td className="p-2">{r.descricao ?? "—"}</td>
                        <td className="p-2 text-muted-foreground">
                          {r.motivo ?? (r.campos ?? []).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
