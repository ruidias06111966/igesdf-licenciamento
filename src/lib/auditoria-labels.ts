/**
 * Tradução do histórico para linguagem de quem trata do licenciamento:
 * nomes de colunas viram rótulos do formulário e valores técnicos viram o
 * texto que aparece nos ecrãs.
 */
import { formatDate } from "@/lib/dates";
import { orgaoLabel, statusLabel, type Orgao, type StatusLicenca } from "@/lib/domain";

export const CAMPO_LABEL: Record<string, string> = {
  unidade_id: "Unidade",
  orgao: "Órgão",
  descricao: "Descrição / CNAE",
  numero: "Número da licença",
  processo_sei: "Processo SEI",
  status: "Estado",
  data_emissao: "Emissão",
  data_vencimento: "Vencimento",
  data_protocolo: "Protocolo",
  observacoes: "Observações",
  titulo: "Título",
  tipo: "Tipo",
  conteudo: "Conteúdo",
  tags: "Etiquetas",
  tipo_unidade: "Tipo de unidade",
  situacao: "Situação",
  responsavel: "Responsável",
  prazo: "Prazo",
  ativo: "Ativo",
  ativa: "Ativa",
};

export const ENTIDADE_LABEL: Record<string, string> = {
  licencas: "Licenças",
  unidades: "Unidades",
  cnaes_unidade: "CNAEs",
  documentos: "Documentos",
  processos_sei: "Processos SEI",
  processo_itens: "Itens de processo",
  ia_modelos: "Modelos",
  despachos: "Despachos",
  consolidado: "Consolidado da rede",
  orgaos: "Órgãos",
};

export const ACAO_LABEL: Record<string, string> = {
  criar: "Criação",
  atualizar: "Alteração",
  excluir: "Exclusão",
  gerar: "Emissão",
  importar: "Importação",
  restaurar: "Reposição de versão",
};

export const PERFIL_LABEL: Record<string, string> = {
  master: "Master",
  edicao: "Edição",
  leitura: "Consulta",
};

const DATAS = new Set(["data_emissao", "data_vencimento", "data_protocolo", "prazo", "validade"]);

export function valorLegivel(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (campo === "status") return statusLabel(valor as StatusLicenca);
  if (campo === "orgao") return orgaoLabel(valor as Orgao);
  if (DATAS.has(campo)) return formatDate(String(valor));
  const texto = String(valor);
  return texto.length > 120 ? `${texto.slice(0, 120)}…` : texto;
}

export function campoLegivel(campo: string) {
  return CAMPO_LABEL[campo] ?? campo.replace(/_/g, " ");
}

export function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
