import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Palette, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/sub-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  carregarTemaExport,
  corPadrao,
  corSituacao,
  guardarTemaExport,
  MARCA,
  MARCA_PADRAO,
  SITUACOES_LEGENDA,
  type TemaExport,
} from "@/lib/exportar/paleta";

export const Route = createFileRoute("/_authenticated/exportacao")({
  component: Pagina,
  head: () => ({
    meta: [
      { title: "Cores das exportações · IGESDF Licenciamento" },
      {
        name: "description",
        content:
          "Configure a paleta institucional e as cores do semáforo usadas no PDF, Excel e Word das exportações do licenciamento do IGESDF.",
      },
      { property: "og:title", content: "Cores das exportações · IGESDF Licenciamento" },
      {
        property: "og:description",
        content: "Paleta institucional e semáforo de validade das exportações do IGESDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CAMPOS_MARCA: { chave: keyof typeof MARCA_PADRAO; rotulo: string }[] = [
  { chave: "fundo", rotulo: "Azul institucional (cabeçalhos)" },
  { chave: "faixa", rotulo: "Faixa clara (capa)" },
  { chave: "linha", rotulo: "Linhas / bordas" },
  { chave: "zebra", rotulo: "Zebra das tabelas" },
  { chave: "cinza", rotulo: "Texto auxiliar" },
];

function hex(v: string) {
  return `#${v.replace("#", "").toUpperCase()}`;
}

function SeletorCor({
  id,
  rotulo,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {rotulo}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={hex(valor)}
          onChange={(e) => onChange(e.target.value.replace("#", "").toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded border bg-background p-1"
          aria-label={rotulo}
        />
        <Input
          value={hex(valor)}
          onChange={(e) => onChange(e.target.value.replace("#", "").toUpperCase())}
          className="w-28 font-mono text-xs uppercase"
        />
      </div>
    </div>
  );
}

function Pagina() {
  const [marca, setMarca] = useState({ ...MARCA_PADRAO });
  const [cores, setCores] = useState<Record<string, { fundo: string; texto: string }>>({});

  useEffect(() => {
    carregarTemaExport();
    setMarca({ ...MARCA });
    const iniciais: Record<string, { fundo: string; texto: string }> = {};
    for (const s of SITUACOES_LEGENDA) {
      iniciais[s.chave] = corSituacao(s.chave) ?? corPadrao(s.chave);
    }
    setCores(iniciais);
  }, []);

  function guardar() {
    const tema: TemaExport = { marca, cores };
    guardarTemaExport(tema);
    toast.success("Cores atualizadas. As próximas exportações já usam esta paleta.");
  }

  function repor() {
    const padrao: Record<string, { fundo: string; texto: string }> = {};
    for (const s of SITUACOES_LEGENDA) padrao[s.chave] = corPadrao(s.chave);
    setMarca({ ...MARCA_PADRAO });
    setCores(padrao);
    guardarTemaExport({ marca: {}, cores: {} });
    toast.success("Paleta reposta aos valores institucionais de origem.");
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Cores das exportações"
        descricao="Paleta institucional e semáforo aplicados ao PDF, Excel, Word e à impressão — sem mexer no código."
        migalhas={[{ label: "Início", to: "/dashboard" }, { label: "Cores das exportações" }]}
        acoes={
          <>
            <Button variant="outline" onClick={repor}>
              <RotateCcw className="mr-1 size-4" aria-hidden="true" /> Repor padrão
            </Button>
            <Button onClick={guardar}>
              <Save className="mr-1 size-4" aria-hidden="true" /> Guardar
            </Button>
          </>
        }
      />

      <SubNav grupo="configuracoes" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" aria-hidden="true" /> Identidade institucional
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS_MARCA.map((c) => (
            <SeletorCor
              key={c.chave}
              id={`marca-${c.chave}`}
              rotulo={c.rotulo}
              valor={marca[c.chave]}
              onChange={(v) => setMarca((m) => ({ ...m, [c.chave]: v }))}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Semáforo de situação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {SITUACOES_LEGENDA.map((s) => {
            const cor = cores[s.chave] ?? corPadrao(s.chave);
            return (
              <div
                key={s.chave}
                className="grid items-end gap-4 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto]"
              >
                <div
                  className="rounded px-3 py-2 text-sm font-semibold"
                  style={{ background: hex(cor.fundo), color: hex(cor.texto) }}
                >
                  {s.rotulo}
                </div>
                <SeletorCor
                  id={`${s.chave}-fundo`}
                  rotulo="Fundo"
                  valor={cor.fundo}
                  onChange={(v) =>
                    setCores((c) => ({ ...c, [s.chave]: { ...cor, fundo: v } }))
                  }
                />
                <SeletorCor
                  id={`${s.chave}-texto`}
                  rotulo="Texto"
                  valor={cor.texto}
                  onChange={(v) =>
                    setCores((c) => ({ ...c, [s.chave]: { ...cor, texto: v } }))
                  }
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
