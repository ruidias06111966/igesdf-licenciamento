/**
 * Campos de texto e data vazios devem gravar `NULL`, não `""`.
 *
 * Uma string vazia numa coluna `DATE` faz o Postgres rejeitar a escrita, e em
 * colunas de texto quebra os `IS NULL` usados nos filtros, nos relatórios e nos
 * campos "—" da interface. Antes cada handler repetia a sua própria lista de
 * campos a limpar, e alguns esqueciam-se de metade.
 */
export function vaziosParaNulo<T extends Record<string, unknown>>(dados: T): T {
  const saida = { ...dados };
  for (const chave of Object.keys(saida) as (keyof T)[]) {
    const valor = saida[chave];
    if (typeof valor === "string" && valor.trim() === "") {
      saida[chave] = null as T[keyof T];
    }
  }
  return saida;
}
