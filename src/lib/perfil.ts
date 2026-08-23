import { useQuery } from "@tanstack/react-query";
import { verificarAcesso } from "@/lib/acesso.functions";

/**
 * Perfil da sessão, lido do servidor a partir do token da conta.
 *
 * Serve para esconder os controlos de escrita a quem só tem consulta — a
 * barreira real está nas funções de servidor (`requireEdicao`/`requireMaster`).
 */
export function usePerfil() {
  return useQuery({
    queryKey: ["perfil-acesso"],
    queryFn: () => verificarAcesso(),
    staleTime: 5 * 60_000,
  });
}

export function usePodeEditar(): boolean {
  const { data } = usePerfil();
  // Enquanto carrega assume-se edição, para não piscar a interface a quem edita.
  return data ? data.perfil === "edicao" || data.perfil === "master" : true;
}

export function useSomenteConsulta(): boolean {
  return !usePodeEditar();
}

/** Só o perfil master vê a IA, os despachos e a gestão de utilizadores. */
export function useEhMaster(): boolean {
  const { data } = usePerfil();
  return data?.perfil === "master";
}
