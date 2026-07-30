import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { sair, verificarAcesso } from "@/lib/acesso.functions";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  // O cookie de acesso é HttpOnly, logo só o servidor o consegue ler. O guarda
  // pergunta ao servidor em vez de inspecionar o navegador.
  beforeLoad: async () => {
    const { autorizado } = await verificarAcesso();
    if (!autorizado) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function logout() {
    await sair();
    // Sem isto os dados ficariam no cache e apareceriam brevemente para a
    // próxima pessoa a usar o mesmo navegador.
    queryClient.clear();
    await router.invalidate();
    await router.navigate({ to: "/auth" });
  }

  return <AppShell onLogout={logout} />;
}
