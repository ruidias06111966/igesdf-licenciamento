/**
 * Tipos partilhados da validação do sistema.
 *
 * O painel de validação corre um conjunto de conferências sobre os dados e
 * apresenta cada achado com a ação de correção correspondente. Os tipos ficam
 * aqui (módulo seguro para o navegador) porque são usados tanto pela função de
 * servidor que faz a conferência como pela página que a mostra.
 */

export type Severidade = "erro" | "aviso" | "informacao";

/** Ação direta que o painel oferece para resolver um grupo de achados. */
export type AcaoCorrecao =
  | "marcar_dispensada"
  | "marcar_nao_iniciado"
  | "sincronizar_vencidas"
  | "reler_certificados"
  | "nenhuma";

export type ItemProblema = {
  /** Identificador do registo em causa (licença, unidade, documento…). */
  id: string;
  rotulo: string;
  detalhe: string;
};

export type GrupoProblema = {
  chave: string;
  titulo: string;
  descricao: string;
  recomendacao: string;
  severidade: Severidade;
  acao: AcaoCorrecao;
  total: number;
  itens: ItemProblema[];
};

export type ResultadoValidacao = {
  executado_em: string;
  total_problemas: number;
  total_itens: number;
  grupos: GrupoProblema[];
};

export type ExecucaoValidacao = {
  id: string;
  executado_em: string;
  executado_por: string | null;
  total_problemas: number;
  total_itens: number;
};

export const SEVERIDADE_LABEL: Record<Severidade, string> = {
  erro: "Erro",
  aviso: "Aviso",
  informacao: "Informação",
};

export const ACAO_LABEL: Record<AcaoCorrecao, string> = {
  marcar_dispensada: "Marcar como dispensada",
  marcar_nao_iniciado: "Marcar como não iniciado",
  sincronizar_vencidas: "Executar correção automática",
  reler_certificados: "Reler certificado arquivado",
  nenhuma: "Sem ação automática",
};
