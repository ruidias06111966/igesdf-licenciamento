import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { TableScroll } from "@/components/data-table";
import { PrintModeToggle } from "@/components/print-mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { baixarCsv, sufixoData } from "@/lib/csv";
import { cn } from "@/lib/utils";
import {
  ROTULO_CATEGORIA,
  ROTULO_TITULAR,
  RAIZ_IGESDF,
  RAIZ_SES,
  UNIDADES_CNPJ,
  cnpjDigitos,
  cnpjFormatado,
  copiarTexto,
  sesDigitos,
  type CategoriaCnpj,
  type UnidadeCnpj,
} from "@/lib/cnpj-unidades";

export const Route = createFileRoute("/_authenticated/cnpj")({
  component: CnpjPage,
  head: () => ({
    meta: [
      { title: "Cadastro CNPJ — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Quadro de consulta com os CNPJ do IGESDF e da SES-DF, número CNES e código SOULMV de cada unidade, com cópia rápida e exportação.",
      },
      { property: "og:title", content: "Cadastro CNPJ das unidades — IGESDF" },
      {
        property: "og:description",
        content: "CNPJ, CNES e código MV das 18 unidades do IGESDF, com busca, cópia e exportação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/cnpj" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/cnpj" }],
  }),
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

const FILTROS: { valor: "todos" | CategoriaCnpj; label: string }[] = [
  { valor: "todos", label: "Todas" },
  { valor: "hospital", label: "Hospitais" },
  { valor: "upa", label: "UPAs" },
  { valor: "apoio", label: "Apoio" },
];

/** Número clicável que copia os dígitos para a área de transferência. */
function BotaoCopiar({
  digitos,
  children,
  className,
  rotulo,
}: {
  digitos: string;
  children: React.ReactNode;
  className?: string;
  rotulo: string;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      title={`Copiar ${digitos}`}
      aria-label={`Copiar ${rotulo} ${digitos}`}
      onClick={async () => {
        const ok = await copiarTexto(digitos);
        if (!ok) {
          toast.error("O navegador bloqueou a cópia. Selecione o número e use Ctrl+C.");
          return;
        }
        setCopiado(true);
        toast.success(`${rotulo} copiado: ${digitos}`);
        setTimeout(() => setCopiado(false), 1400);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-sm transition-colors",
        "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {children}
      {copiado ? (
        <Check className="size-3 shrink-0 text-primary no-print" aria-hidden="true" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-0 no-print group-hover:opacity-60" aria-hidden="true" />
      )}
    </button>
  );
}

function CnpjPage() {
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<"todos" | CategoriaCnpj>("todos");

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return UNIDADES_CNPJ.filter((u) => {
      if (filtro !== "todos" && u.cat !== filtro) return false;
      if (!t) return true;
      return [
        u.nome,
        u.fantasia,
        u.bairro,
        u.endereco,
        u.cep,
        u.cnae,
        u.cnaeDesc,
        u.cnes ?? "",
        u.mv ?? "",
        cnpjFormatado(u),
        cnpjDigitos(u),
        u.cnpjSes ?? "",
        sesDigitos(u.cnpjSes) ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(t);
    });
  }, [termo, filtro]);

  const exportarCsv = () =>
    baixarCsv(`unidades-cnpj-igesdf-${sufixoData()}`, visiveis, [
      { cabecalho: "Código MV", valor: (u) => u.mv ?? "" },
      { cabecalho: "CNPJ IGESDF", valor: (u) => cnpjFormatado(u) },
      { cabecalho: "CNPJ IGESDF (dígitos)", valor: (u) => cnpjDigitos(u) },
      { cabecalho: "CNPJ SES-DF", valor: (u) => (u.cnpjSes ? `${RAIZ_SES}/${u.cnpjSes}` : "") },
      { cabecalho: "CNPJ SES-DF (dígitos)", valor: (u) => sesDigitos(u.cnpjSes) ?? "" },
      { cabecalho: "CNES", valor: (u) => u.cnes ?? "" },
      { cabecalho: "CNPJ titular do CNES", valor: (u) => u.cnpjCnes ?? "" },
      { cabecalho: "Titularidade CNES", valor: (u) => ROTULO_TITULAR[u.titular] },
      { cabecalho: "Tipo", valor: (u) => u.tipo },
      { cabecalho: "Categoria", valor: (u) => ROTULO_CATEGORIA[u.cat] },
      { cabecalho: "Unidade", valor: (u) => u.nome },
      { cabecalho: "CNAE principal", valor: (u) => u.cnae },
      { cabecalho: "Início da atividade", valor: (u) => u.inicio },
      { cabecalho: "Endereço", valor: (u) => u.endereco },
      { cabecalho: "Bairro", valor: (u) => u.bairro },
      { cabecalho: "CEP", valor: (u) => u.cep },
      { cabecalho: "Situação", valor: () => "ATIVA" },
    ]);

  const copiarTabela = async () => {
    const linhas = visiveis.map((u) =>
      [
        u.mv ?? "—",
        cnpjFormatado(u),
        u.cnpjSes ? `${RAIZ_SES}/${u.cnpjSes}` : "—",
        u.cnes ?? "—",
        u.nome,
      ].join("\t"),
    );
    const ok = await copiarTexto(
      ["Cód. MV\tCNPJ IGESDF\tCNPJ SES-DF\tCNES\tUnidade", ...linhas].join("\n"),
    );
    toast[ok ? "success" : "error"](
      ok ? `${visiveis.length} linha(s) copiadas.` : "O navegador bloqueou a cópia.",
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Cadastro CNPJ das unidades"
        descricao={
          <>
            Raiz IGESDF <span className="font-mono">{RAIZ_IGESDF}</span> · raiz SES-DF{" "}
            <span className="font-mono">{RAIZ_SES}</span> · {UNIDADES_CNPJ.length} estabelecimentos ·
            clique em qualquer número para copiar.
          </>
        }
        acoes={
          <>
            <Button variant="outline" onClick={copiarTabela}>
              <Copy className="mr-1 size-4" aria-hidden="true" /> Copiar tabela
            </Button>
            <Button variant="outline" onClick={exportarCsv}>
              <Download className="mr-1 size-4" aria-hidden="true" /> Exportar CSV
            </Button>
            <PrintModeToggle defaultOrientation="landscape" />
          </>
        }
      />

      <div className="flex flex-col gap-3 no-print sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por unidade, CNPJ, CNES, código MV, bairro ou CNAE"
            aria-label="Buscar unidade"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de unidade">
          {FILTROS.map((f) => (
            <Button
              key={f.valor}
              size="sm"
              variant={filtro === f.valor ? "default" : "outline"}
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <TableScroll className="rounded-lg border">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="p-3 font-medium">#</th>
              <th className="p-3 font-medium">CNPJ</th>
              <th className="p-3 font-medium">CNES</th>
              <th className="p-3 font-medium">Cód. MV</th>
              <th className="p-3 font-medium">Unidade</th>
              <th className="p-3 font-medium">Tipo</th>
              <th className="p-3 font-medium">CNAE principal</th>
              <th className="p-3 font-medium">Início</th>
              <th className="p-3 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((u) => (
              <LinhaUnidade key={u.ordem} u={u} />
            ))}
          </tbody>
        </table>
      </TableScroll>

      {visiveis.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma unidade encontrada. Ajuste a busca ou volte ao filtro “Todas”.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {visiveis.length} de {UNIDADES_CNPJ.length} unidades · Fontes: dados abertos do CNPJ (Receita
        Federal) e CNES (Ministério da Saúde), consulta em 05/08/2026.
      </p>

      <div className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>15 unidades têm dois CNPJ ativos para o mesmo endereço</strong> — um do IGESDF e
          outro da SES-DF, ambos regulares na Receita. O CNES está sob o CNPJ da SES-DF em 13 casos
          (todas as UPAs) e sob o CNPJ do IGESDF apenas no Hospital de Base e no HRSM. Confira sempre
          qual CNPJ o órgão fiscalizador exige antes de protocolar. Para habilitação, certidão ou
          instrução processual, emita o Comprovante de Inscrição na Receita Federal e o extrato do
          CNES e anexe ao SEI.
        </span>
      </div>
    </div>
  );
}

function LinhaUnidade({ u }: { u: UnidadeCnpj }) {
  return (
    <tr className="group border-b align-top last:border-0 hover:bg-muted/40">
      <td className="p-3 font-mono text-xs text-muted-foreground">{u.ordem}</td>
      <td className="p-3">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="w-14 shrink-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              IGESDF
            </span>
            <BotaoCopiar digitos={cnpjDigitos(u)} rotulo="CNPJ IGESDF">
              <span className="text-muted-foreground">{RAIZ_IGESDF}/</span>
              <span className="font-semibold">
                {u.ordem}-{u.dv}
              </span>
            </BotaoCopiar>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="w-14 shrink-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              SES-DF
            </span>
            {u.cnpjSes ? (
              <BotaoCopiar digitos={sesDigitos(u.cnpjSes)!} rotulo="CNPJ SES-DF">
                <span className="text-muted-foreground">{RAIZ_SES}/</span>
                <span className="font-semibold">{u.cnpjSes}</span>
              </BotaoCopiar>
            ) : (
              <span className="px-1 font-mono text-sm text-muted-foreground">não possui</span>
            )}
          </div>
        </div>
      </td>
      <td className="p-3">
        {u.cnes ? (
          <BotaoCopiar digitos={u.cnes} rotulo="CNES">
            <span className="font-semibold">{u.cnes}</span>
          </BotaoCopiar>
        ) : (
          <span className="px-1 font-mono text-sm text-muted-foreground">—</span>
        )}
        <span
          className={cn(
            "mt-1 block pl-1 text-[10px] font-semibold tracking-wide",
            u.titular === "pendente" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {ROTULO_TITULAR[u.titular]}
        </span>
      </td>
      <td className="p-3">
        {u.mv ? (
          <BotaoCopiar digitos={u.mv} rotulo="Código MV">
            <span className="font-semibold">{u.mv}</span>
          </BotaoCopiar>
        ) : (
          <span className="px-1 font-mono text-sm text-muted-foreground">—</span>
        )}
        {u.mvNota && (
          <span className="mt-1 block max-w-[130px] pl-1 text-[10px] leading-tight text-muted-foreground">
            {u.mvNota}
          </span>
        )}
      </td>
      <td className="p-3">
        <span className="block font-medium">{u.nome}</span>
        <span className="block text-xs text-muted-foreground">
          {u.endereco} · {u.bairro} · CEP {u.cep}
        </span>
      </td>
      <td className="p-3">
        <Badge variant={u.tipo === "Matriz" ? "default" : "secondary"}>
          {ROTULO_CATEGORIA[u.cat]}
        </Badge>
        <span className="mt-1 block text-[10px] tracking-wide text-muted-foreground uppercase">
          {u.tipo}
        </span>
      </td>
      <td className="p-3">
        <span className="font-mono text-xs whitespace-nowrap">{u.cnae}</span>
        <span className="mt-0.5 block max-w-[180px] text-[11px] leading-tight text-muted-foreground">
          {u.cnaeDesc}
        </span>
      </td>
      <td className="p-3 whitespace-nowrap">{u.inicio}</td>
      <td className="p-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> ATIVA
        </span>
      </td>
    </tr>
  );
}
