import { useCallback, useMemo, useState } from "react";

export type Direcao = "asc" | "desc";

export type Ordenacao<K extends string> = { chave: K; direcao: Direcao };

/**
 * Ordenação de tabela controlada por clique no cabeçalho.
 *
 * `acessores` devolve o valor comparável de cada coluna. Valores vazios vão
 * sempre para o fim, independentemente da direção — numa matriz de compliance
 * "sem data" nunca deve disputar o topo com uma licença vencida.
 */
export function useOrdenacao<T, K extends string>(
  itens: T[],
  acessores: Record<K, (item: T) => string | number | null | undefined>,
  inicial: Ordenacao<K>,
) {
  const [ordem, setOrdem] = useState<Ordenacao<K>>(inicial);

  const alternar = useCallback((chave: K) => {
    setOrdem((atual) =>
      atual.chave === chave
        ? { chave, direcao: atual.direcao === "asc" ? "desc" : "asc" }
        : { chave, direcao: "asc" },
    );
  }, []);

  const ordenados = useMemo(() => {
    const acessor = acessores[ordem.chave];
    if (!acessor) return itens;
    const fator = ordem.direcao === "asc" ? 1 : -1;
    // Cópia: ordenar o array recebido mutaria o resultado memoizado do filtro.
    return [...itens].sort((a, b) => {
      const va = acessor(a);
      const vb = acessor(b);
      const aVazio = va === null || va === undefined || va === "";
      const bVazio = vb === null || vb === undefined || vb === "";
      if (aVazio && bVazio) return 0;
      if (aVazio) return 1;
      if (bVazio) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * fator;
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true }) * fator;
    });
    // `acessores` é recriado a cada render por desenho, por isso fica fora das
    // dependências; a ordenação depende apenas dos itens e da coluna/direção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, ordem.chave, ordem.direcao]);

  return { ordenados, ordem, alternar };
}
