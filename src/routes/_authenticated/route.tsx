import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { verificarAcesso } from "@/lib/acesso.functions";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  // A sessão vive no navegador (localStorage), por isso o guarda só corre no
  // cliente; o perfil em si é sempre confirmado no servidor.
  ssr: false,
  beforeLoad: async () => {
    const estado = await verificarAcesso();
    if (!estado.sessao) throw redirect({ to: "/auth" });
    if (!estado.autorizado) throw redirect({ to: "/pendente" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function logout() {
    // Sem isto os dados ficariam no cache e apareceriam brevemente para a
    // próxima pessoa a usar o mesmo navegador.
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    await router.navigate({ to: "/auth", replace: true });
  }

  return <AppShell onLogout={logout} />;
}
