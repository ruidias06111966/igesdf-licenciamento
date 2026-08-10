import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";

type Detalhes = {
  client?: { name?: string; client_id?: string } | null;
  redirect_uri?: string | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type Resposta = { data: Detalhes | null; error: { message: string } | null };

// O namespace supabase.auth.oauth ainda é beta e pode não estar tipado.
const oauth = (
  supabase.auth as unknown as {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<Resposta>;
      approveAuthorization: (id: string) => Promise<Resposta>;
      denyAuthorization: (id: string) => Promise<Resposta>;
    };
  }
).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id") ?? "";
    if (!id) throw new Error("Pedido de autorização inválido (falta authorization_id).");
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) return { autenticado: false as const, detalhes: null };
    const { data, error } = await oauth.getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const imediato = data?.redirect_url ?? data?.redirect_to;
    if (imediato && !data?.client) throw redirect({ href: imediato });
    return { autenticado: true as const, detalhes: data, email: sessao.session.user.email };
  },
  component: Consentimento,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold">Não foi possível carregar o pedido</h1>
      <p className="text-muted-foreground text-sm">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consentimento() {
  const dados = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setOcupado(true);
    setErro(null);
    const resultado = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.href,
    });
    if (resultado.error) {
      setOcupado(false);
      setErro(resultado.error.message);
      return;
    }
    if (!("redirected" in resultado && resultado.redirected)) window.location.reload();
  }

  async function decidir(aprovar: boolean) {
    setOcupado(true);
    setErro(null);
    const { data, error } = aprovar
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setOcupado(false);
      setErro(error.message);
      return;
    }
    const destino = data?.redirect_url ?? data?.redirect_to;
    if (!destino) {
      setOcupado(false);
      setErro("O servidor de autorização não devolveu um destino de redirecionamento.");
      return;
    }
    window.location.href = destino;
  }

  if (!dados.autenticado) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Iniciar sessão para continuar</h1>
        <p className="text-muted-foreground text-sm">
          Para autorizar o acesso às ferramentas do IGESDF — Licenciamento, inicie sessão com a sua
          conta Google autorizada.
        </p>
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}
        <Button onClick={entrar} disabled={ocupado}>
          Entrar com Google
        </Button>
      </main>
    );
  }

  const nomeCliente = dados.detalhes?.client?.name ?? "a aplicação";
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Ligar {nomeCliente} ao IGESDF — Licenciamento</h1>
      <p className="text-muted-foreground text-sm">
        Isto permite que {nomeCliente} consulte, em seu nome, as unidades, licenças, prazos,
        processos SEI e normativas do sistema. Só ferramentas de leitura são disponibilizadas.
      </p>
      <p className="text-muted-foreground text-xs">Sessão: {dados.email}</p>
      {dados.detalhes?.redirect_uri && (
        <p className="text-muted-foreground text-xs break-all">
          Redirecionamento: {dados.detalhes.redirect_uri}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => decidir(true)} disabled={ocupado}>
          Autorizar
        </Button>
        <Button variant="outline" onClick={() => decidir(false)} disabled={ocupado}>
          Cancelar ligação
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        O acesso continua limitado às contas de e-mail autorizadas pelo administrador.
      </p>
    </main>
  );
}
