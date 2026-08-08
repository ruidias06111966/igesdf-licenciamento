import { useQuery } from "@tanstack/react-query";
import { verificarAcesso } from "@/lib/acesso.functions";

/**
 * Perfil da sessão, lido do servidor (o cookie é HttpOnly).
 *
 * Serve apenas para esconder os controlos de escrita a quem entrou com a senha
 * de consulta — a barreira real está nas funções de servidor (`requireEdicao`).
 */
export function usePodeEditar(): boolean {
  const { data } = useQuery({
    queryKey: ["perfil-acesso"],
    queryFn: () => verificarAcesso(),
    staleTime: 5 * 60_000,
  });
  // Enquanto carrega assume-se edição, para não piscar a interface a quem edita.
  return data ? data.perfil === "edicao" : true;
}

export function useSomenteConsulta(): boolean {
  return !usePodeEditar();
}
