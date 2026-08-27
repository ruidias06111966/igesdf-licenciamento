import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Info,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/sub-nav";
import { ErrorState } from "@/components/states";
import { BotaoExportar } from "@/components/botao-exportar";
import { CertificadoAnalise } from "@/components/certificado-analise";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analisarCertificado, listarCertificados } from "@/lib/certificado.functions";
import type { AnaliseCertificado } from "@/lib/certificado";
import { executarSincronizacao } from "@/lib/rotina.functions";
import {
  corrigirSituacaoLicencas,
  executarValidacao,
  listarExecucoesValidacao,
} from "@/lib/validacao.functions";
import { SEVERIDADE_LABEL, type GrupoProblema, type Severidade } from "@/lib/validacao";
import { dataHora } from "@/lib/auditoria-labels";
import { mensagemErro } from "@/lib/errors";
import { usePodeEditar } from "@/lib/perfil";
import { invalidarDados } from "@/lib/queries";
import type { ColunaCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/validacao")({
  head: () => ({
    meta: [
      { title: "Validação do sistema — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Conferência de coerência dos dados de licenciamento do IGESDF, com correção direta das pendências, histórico das execuções e relatório em PDF ou CSV.",
      },
      { property: "og:title", content: "Validação do sistema — IGESDF - Licenciamento" },
      {
        property: "og:description",
        content: "Pendências de dados, ações de correção e relatório de validação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValidacaoPage,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

const ICONE: Record<Severidade, typeof AlertTriangle> = {
  erro: AlertTriangle,
  aviso: AlertTriangle,
  informacao: Info,
};

const COR: Record<Severidade, string> = {
  erro: "text-destructive",
  aviso: "text-amber-600 dark:text-amber-400",
  informacao: "text-muted-foreground",
};

type LinhaRelatorio = {
  grupo: string;
  severidade: string;
  registo: string;
  detalhe: string;
  recomendacao: string;
};

const COLUNAS: ColunaCsv<LinhaRelatorio>[] = [
  { cabecalho: "Verificação", valor: (l) => l.grupo, largura: 42 },
  { cabecalho: "Gravidade", valor: (l) => l.severidade, largura: 14 },
  { cabecalho: "Registo", valor: (l) => l.registo, largura: 38 },
  { cabecalho: "Detalhe", valor: (l) => l.detalhe, largura: 40 },
  { cabecalho: "Recomendação", valor: (l) => l.recomendacao, largura: 60 },
];

function ValidacaoPage() {
  const podeEditar = usePodeEditar();
  const qc = useQueryClient();
  const [analise, setAnalise] = useState<AnaliseCertificado | null>(null);

  const resultado = useQuery({
    queryKey: ["validacao"],
    queryFn: () => executarValidacao(),
    staleTime: 0,
  });

  const historico = useQuery({
    queryKey: ["validacao-execucoes"],
    queryFn: () => listarExecucoesValidacao(),
  });

  const reexecutar = useMutation({
    mutationFn: () => executarValidacao(),
    onSuccess: (dados) => {
      qc.setQueryData(["validacao"], dados);
      void qc.invalidateQueries({ queryKey: ["validacao-execucoes"] });
      toast.success(
        dados.total_itens === 0
          ? "Validação concluída: nenhuma pendência encontrada."
          : `Validação concluída: ${dados.total_itens} pendência(s) em ${dados.total_problemas} verificação(ões).`,
      );
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  const grupos = resultado.data?.grupos ?? [];
  const comProblema = grupos.filter((g) => g.total > 0);

  const linhas = useMemo<LinhaRelatorio[]>(
    () =>
      comProblema.flatMap((g) =>
        g.itens.map((i) => ({
          grupo: g.titulo,
          severidade: SEVERIDADE_LABEL[g.severidade],
          registo: i.rotulo,
          detalhe: i.detalhe,
          recomendacao: g.recomendacao,
        })),
      ),
    [comProblema],
  );

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Validação do sistema"
        descricao="Conferências de coerência dos dados, com correção direta e histórico das execuções."
        migalhas={[
          { label: "Início", to: "/dashboard" },
          { label: "Configurações", to: "/configuracoes" },
          { label: "Validação" },
        ]}
        acoes={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => reexecutar.mutate()}
              disabled={reexecutar.isPending}
            >
              {reexecutar.isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="mr-1 size-4" aria-hidden="true" />
              )}
              Reexecutar validação
            </Button>
            <BotaoExportar
              nomeArquivo="validacao-igesdf"
              modulo="Validacao"
              titulo="IGESDF — Relatório de validação do sistema"
              subtitulo={`${linhas.length} pendência(s) · gerado em ${new Date().toLocaleString("pt-BR")}`}
              folha="Validação"
              linhas={linhas}
              colunas={COLUNAS}
              rotulo="Exportar relatório"
              meta={{ unidade: "Rede IGESDF" }}
            />
          </div>
        }
      />
      <SubNav grupo="configuracoes" />

      {resultado.isLoading && (
        <p className="text-sm text-muted-foreground">A conferir os dados do sistema…</p>
      )}
      {resultado.error && (
        <ErrorState error={resultado.error} onRetry={() => resultado.refetch()} />
      )}

      {resultado.data && (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4 text-sm">
              <div>
                <div className="text-2xl font-semibold">{resultado.data.total_itens}</div>
                <div className="text-muted-foreground">Pendências encontradas</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{resultado.data.total_problemas}</div>
                <div className="text-muted-foreground">
                  Verificações com achados (de {grupos.length})
                </div>
              </div>
              <div className="text-muted-foreground">
                Última execução: {dataHora(resultado.data.executado_em)}
              </div>
            </CardContent>
          </Card>

          {comProblema.length === 0 && (
            <Card>
              <CardContent className="flex items-center gap-2 py-6 text-sm">
                <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
                Nenhuma inconsistência encontrada nas conferências de dados.
              </CardContent>
            </Card>
          )}

          {comProblema.map((g) => (
            <GrupoCard
              key={g.chave}
              grupo={g}
              podeEditar={podeEditar}
              onAnalise={setAnalise}
              onCorrigido={() => {
                invalidarDados(qc);
                reexecutar.mutate();
              }}
            />
          ))}

          <Card className="break-inside-avoid">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4" aria-hidden="true" /> Histórico de execuções
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {historico.data && historico.data.length > 0 ? (
                <ul className="divide-y rounded-md border">
                  {historico.data.map((e) => (
                    <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-1 p-2.5">
                      <span className="font-medium">{dataHora(e.executado_em)}</span>
                      <span className="text-muted-foreground">{e.executado_por ?? "—"}</span>
                      <span className="ml-auto">
                        {e.total_itens} pendência(s) em {e.total_problemas} verificação(ões)
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Ainda não há execuções registadas.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {analise && <CertificadoAnalise analise={analise} onFechar={() => setAnalise(null)} />}
    </div>
  );
}

function GrupoCard({
  grupo,
  podeEditar,
  onCorrigido,
  onAnalise,
}: {
  grupo: GrupoProblema;
  podeEditar: boolean;
  onCorrigido: () => void;
  onAnalise: (a: AnaliseCertificado) => void;
}) {
  const Icone = ICONE[grupo.severidade];
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(grupo.itens.map((i) => i.id)),
  );
  const [status, setStatus] = useState<"dispensada" | "nao_iniciado" | "em_estudo">("dispensada");
  const selecionavel = grupo.acao === "marcar_dispensada";

  const corrigir = useMutation({
    mutationFn: () => corrigirSituacaoLicencas({ data: { ids: [...marcados], status } }),
    onSuccess: (r) => {
      toast.success(`${r.atualizadas} licença(s) atualizada(s).`);
      onCorrigido();
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  const sincronizar = useMutation({
    mutationFn: () => executarSincronizacao(),
    onSuccess: (r) => {
      toast.success(`${r.atualizadas} licença(s) alinhada(s) com a data de validade.`);
      onCorrigido();
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <Card className="break-inside-avoid">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Icone className={`size-4 ${COR[grupo.severidade]}`} aria-hidden="true" />
          {grupo.titulo}
          <Badge variant={grupo.severidade === "erro" ? "destructive" : "secondary"}>
            {grupo.total}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{grupo.descricao}</p>
        <p className="text-xs text-muted-foreground">
          <strong>Recomendação:</strong> {grupo.recomendacao}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="max-h-72 divide-y overflow-auto rounded-md border">
          {grupo.itens.map((i) => (
            <li key={i.id} className="flex items-start gap-2 p-2">
              {selecionavel && podeEditar && (
                <Checkbox
                  className="mt-0.5"
                  checked={marcados.has(i.id)}
                  onCheckedChange={() => alternar(i.id)}
                  aria-label={`Selecionar ${i.rotulo}`}
                />
              )}
              <div className="min-w-0">
                <div className="font-medium">{i.rotulo}</div>
                <div className="text-xs text-muted-foreground">{i.detalhe}</div>
              </div>
              {grupo.acao === "reler_certificados" && podeEditar && (
                <div className="ml-auto">
                  <BotaoReler unidadeId={i.id} onAnalise={onAnalise} />
                </div>
              )}
            </li>
          ))}
        </ul>

        {selecionavel && podeEditar && (
          <div className="no-print flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dispensada">Marcar como dispensada</SelectItem>
                <SelectItem value="em_estudo">Marcar como em estudo</SelectItem>
                <SelectItem value="nao_iniciado">Marcar como não iniciado</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => corrigir.mutate()}
              disabled={marcados.size === 0 || corrigir.isPending}
            >
              {corrigir.isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="mr-1 size-4" aria-hidden="true" />
              )}
              Aplicar a {marcados.size} selecionada(s)
            </Button>
          </div>
        )}

        {grupo.acao === "sincronizar_vencidas" && podeEditar && (
          <Button
            variant="outline"
            className="no-print"
            onClick={() => sincronizar.mutate()}
            disabled={sincronizar.isPending}
          >
            {sincronizar.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="mr-1 size-4" aria-hidden="true" />
            )}
            Executar correção automática
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Releitura dirigida a uma unidade: lista os certificados já arquivados dessa
 * unidade e reprocessa-os por IA. O quadro de diferenças é que grava — aqui só
 * se abre a leitura.
 */
function BotaoReler({
  unidadeId,
  onAnalise,
}: {
  unidadeId: string;
  onAnalise: (a: AnaliseCertificado) => void;
}) {
  const certificados = useQuery({
    queryKey: ["certificados-arquivados"],
    queryFn: () => listarCertificados(),
  });
  const daUnidade = (certificados.data ?? []).filter((c) => c.unidade_id === unidadeId);

  const ler = useMutation({
    mutationFn: (doc: { id: string; storage_path: string }) =>
      analisarCertificado({
        data: { unidade_id: unidadeId, storage_path: doc.storage_path, documento_id: doc.id },
      }),
    onSuccess: (a) => onAnalise(a),
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  if (certificados.isLoading) {
    return <Loader2 className="size-4 animate-spin" aria-hidden="true" />;
  }
  if (daUnidade.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Sem certificado arquivado — arquive o PDF na ficha da unidade
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="no-print"
      onClick={() => ler.mutate(daUnidade[0]!)}
      disabled={ler.isPending}
    >
      {ler.isPending ? (
        <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
      ) : (
        <FileSearch className="mr-1 size-4" aria-hidden="true" />
      )}
      Ler certificado
    </Button>
  );
}
