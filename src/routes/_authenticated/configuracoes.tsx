import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, History, Palette, Upload, Users } from "lucide-react";
import type { ComponentType } from "react";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/sub-nav";
import { useEhMaster } from "@/lib/perfil";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Pagina,
  head: () => ({
    meta: [
      { title: "Configurações · IGESDF Licenciamento" },
      {
        name: "description",
        content:
          "Central de configurações do licenciamento do IGESDF: correção automática, importação de CSV, auditoria e cores das exportações.",
      },
      { property: "og:title", content: "Configurações · IGESDF Licenciamento" },
      {
        property: "og:description",
        content: "Rotinas, importação, auditoria e paleta das exportações num só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ATALHOS: {
  to: string;
  titulo: string;
  descricao: string;
  icon: ComponentType<{ className?: string }>;
  master?: boolean;
}[] = [
  {
    to: "/utilizadores",
    titulo: "Acesso",
    descricao:
      "Autorize quem se cadastra no sistema e defina o perfil: consulta, edição ou master. Só o master vê este painel.",
    icon: Users,
    master: true,
  },
  {
    to: "/rotina",
    titulo: "Correção automática",
    descricao:
      "Horário e fuso da rotina diária que marca as licenças vencidas, e execução em lote.",
    icon: Clock,
  },
  {
    to: "/importar",
    titulo: "Importar CSV",
    descricao:
      "Atualize várias licenças de uma vez a partir de uma planilha, com conferência prévia.",
    icon: Upload,
  },
  {
    to: "/auditoria",
    titulo: "Auditoria",
    descricao: "Quem alterou, quando e o que mudou nas licenças, documentos e despachos.",
    icon: History,
  },
  {
    to: "/exportacao",
    titulo: "Cores das exportações",
    descricao: "Paleta institucional e semáforo aplicados ao PDF, Excel, Word e impressão.",
    icon: Palette,
  },
];

function Pagina() {
  const ehMaster = useEhMaster();
  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Configurações"
        descricao="Tudo o que se ajusta no sistema, reunido num só sítio."
        migalhas={[{ label: "Início", to: "/dashboard" }, { label: "Configurações" }]}
      />
      <SubNav grupo="configuracoes" />

      <div className="grid gap-4 sm:grid-cols-2">
        {ATALHOS.filter((a) => !a.master || ehMaster).map(
          ({ to, titulo, descricao, icon: Icone }) => (
            <Link key={to} to={to} className="block">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icone className="size-4" aria-hidden="true" /> {titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{descricao}</CardContent>
              </Card>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
