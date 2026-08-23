import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/lib/perfil";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/pendente")({
  component: Pagina,
  head: () => ({
    meta: [
      { title: "Acesso pendente — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "A sua conta aguarda autorização do utilizador master do sistema de licenciamento do IGESDF.",
      },
      { property: "og:title", content: "Acesso pendente — IGESDF - Licenciamento" },
      {
        property: "og:description",
        content: "A conta aguarda autorização do utilizador master.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Pagina() {
  const { data } = usePerfil();
  const navegar = useNavigate();
  const queryClient = useQueryClient();

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navegar({ to: "/auth", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
            <span className="font-semibold">IGESDF - Licenciamento</span>
          </div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" aria-hidden="true" />
            {data?.suspenso ? "Acesso suspenso" : "Aguardando autorização"}
          </CardTitle>
          <CardDescription>
            {data?.suspenso
              ? "O seu acesso foi suspenso pelo utilizador master. Contacte-o para o reativar."
              : "A sua conta foi confirmada. Falta o utilizador master autorizar o seu perfil (consulta, edição ou master). Assim que autorizar, basta recarregar esta página."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data?.email && (
            <p className="text-muted-foreground">
              Conta: <span className="font-medium text-foreground">{data.email}</span>
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Verificar novamente</Button>
            <Button variant="ghost" onClick={sair}>
              <LogOut className="mr-2 size-4" aria-hidden="true" /> Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
