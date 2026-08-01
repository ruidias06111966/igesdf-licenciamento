import { queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  getDossieUnidade,
  getUnidade,
  listDashboard,
  listProximosPassos,
  listUnidades,
} from "@/lib/licencas.functions";
import { listNormativas } from "@/lib/normativas.functions";
import { listOrgaos } from "@/lib/orgaos.functions";
import { getProcesso, listProcessos } from "@/lib/processos.functions";

/**
 * Fonte única das consultas e das chaves de cache.
 *
 * O problema que isto resolve: `listDashboard()` estava registado sob DUAS
 * chaves diferentes — `["dashboard"]` no painel e `["licencas-all"]` nas
 * páginas de licenças, calendário e relatórios. Eram os mesmos dados em dois
 * caches independentes, então qualquer gravação que invalidasse apenas uma das
 * chaves deixava a outra desatualizada: o painel mostrava um número e a
 * listagem mostrava outro, para a mesma licença.
 *
 * Havia ainda vários pontos que esqueciam parte das chaves. Renomear uma
 * unidade, por exemplo, atualizava o painel mas deixava o nome antigo nas
 * licenças, no calendário e nos relatórios; excluir uma licença dentro da ficha
 * da unidade não descontava do painel.
 *
 * Agora cada conjunto de dados tem exatamente uma chave, e as gravações usam
 * `invalidarDados`, que revalida tudo. Não há como um ponto de gravação
 * esquecer-se de uma chave.
 */
export const chaves = {
  unidades: ["unidades"] as const,
  unidade: (id: string) => ["unidade", id] as const,
  /** Licenças + dados da unidade + semáforo (view v_licencas_dashboard). */
  licencas: ["licencas"] as const,
  proximosPassos: ["proximos-passos"] as const,
  dossie: (id: string) => ["dossie", id] as const,
  checklist: (licencaId: string) => ["checklist", licencaId] as const,
  versoes: (documentoId: string) => ["versoes", documentoId] as const,
  orgaos: ["orgaos"] as const,
  normativas: ["normativas"] as const,
  processos: ["processos"] as const,
  processo: (id: string) => ["processo", id] as const,
};

export const unidadesQuery = queryOptions({
  queryKey: chaves.unidades,
  queryFn: () => listUnidades(),
});

export const licencasQuery = queryOptions({
  queryKey: chaves.licencas,
  queryFn: () => listDashboard(),
});

export const proximosPassosQuery = queryOptions({
  queryKey: chaves.proximosPassos,
  queryFn: () => listProximosPassos(),
});

export const orgaosQuery = queryOptions({
  queryKey: chaves.orgaos,
  queryFn: () => listOrgaos(),
});

export const normativasQuery = queryOptions({
  queryKey: chaves.normativas,
  queryFn: () => listNormativas(),
});

export const processosQuery = queryOptions({
  queryKey: chaves.processos,
  queryFn: () => listProcessos(),
});

export function processoQuery(id: string) {
  return queryOptions({
    queryKey: chaves.processo(id),
    queryFn: () => getProcesso({ data: { id } }),
  });
}

export function unidadeQuery(id: string) {
  return queryOptions({
    queryKey: chaves.unidade(id),
    queryFn: () => getUnidade({ data: { id } }),
  });
}

export function dossieQuery(id: string) {
  return queryOptions({
    queryKey: chaves.dossie(id),
    queryFn: () => getDossieUnidade({ data: { id } }),
  });
}

/**
 * Revalida todos os dados de licenciamento depois de uma gravação.
 *
 * Deliberadamente amplo: unidades, licenças, CNAEs, documentos, responsáveis e
 * checklists são todos derivados das mesmas poucas tabelas e aparecem cruzados
 * em quase todas as páginas — o painel soma licenças, o dossiê repete-as, a
 * ficha da unidade mostra o nome que a listagem também mostra. Invalidar por
 * chave individual seria mais económico, mas foi exatamente essa micro-gestão
 * que produziu painéis a discordar entre si.
 *
 * A rede tem uma escala de dezenas de unidades e algumas centenas de licenças,
 * logo revalidar tudo custa poucos pedidos e garante que qualquer ecrã aberto
 * passa a mostrar o mesmo estado.
 */
export function invalidarDados(qc: QueryClient) {
  void qc.invalidateQueries();
}
