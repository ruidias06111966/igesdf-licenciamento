import { useQuery } from "@tanstack/react-query";
import { chaves } from "@/lib/queries";
import { listarEmpresas } from "@/lib/empresas.functions";

export type EmpresaAtual = {
  id: string;
  sigla: string;
  nome: string;
  logo_url: string | null;
};

/**
 * Empresa da sessão, para a interface e os documentos.
 *
 * O `listarEmpresas` já devolve só o que a conta alcança: uma empresa para quem
 * pertence a uma, todas para o master global. Por isso a regra é simples —
 * havendo exatamente uma, é essa; havendo várias, quem está a ver é o
 * responsável pelo sistema e não há cliente único a representar.
 *
 * Devolver `null` nesse caso é de propósito: a interface passa então a mostrar
 * só a marca do produto. Escolher uma das empresas ao acaso poria o logótipo de
 * um cliente num documento de outro.
 */
export function useEmpresaAtual(): EmpresaAtual | null {
  const { data } = useQuery({
    queryKey: chaves.empresas,
    queryFn: () => listarEmpresas(),
    staleTime: 5 * 60_000,
  });

  const ativas = (data ?? []).filter((e) => e.ativa);
  if (ativas.length !== 1) return null;
  const e = ativas[0]!;
  return { id: e.id, sigla: e.sigla, nome: e.nome, logo_url: e.logo_url };
}
