/**
 * Tipos e rótulos da leitura automática do certificado da unidade.
 *
 * Este ficheiro é puro (sem acesso a rede ou banco) para poder ser importado
 * tanto pelo componente que mostra o quadro de diferenças como pelo servidor
 * que o produz — assim as duas pontas nunca discordam sobre o formato.
 */
import type { Orgao, StatusLicenca } from "@/lib/domain";

/** Campos de uma licença que a leitura do certificado pode propor alterar. */
export const CAMPOS_LICENCA = [
  "status",
  "numero",
  "processo_sei",
  "data_emissao",
  "data_vencimento",
  "observacoes",
] as const;

export type CampoLicenca = (typeof CAMPOS_LICENCA)[number];

export const CAMPO_LABEL: Record<CampoLicenca, string> = {
  status: "Situação",
  numero: "Número",
  processo_sei: "Processo SEI",
  data_emissao: "Emissão",
  data_vencimento: "Vencimento",
  observacoes: "Observações / condicionantes",
};

export type ValoresLicenca = Partial<Record<CampoLicenca, string | null>>;

export type Diferenca = { campo: CampoLicenca; antes: string | null; depois: string | null };

/** Uma linha do quadro de comparação. `chave` identifica a linha na aplicação. */
export type LinhaAnalise =
  | {
      tipo: "cnae_novo";
      chave: string;
      codigo: string;
      descricao: string;
    }
  | {
      tipo: "licenca_nova";
      chave: string;
      orgao: Orgao;
      cnae: string | null;
      descricao: string;
      valores: ValoresLicenca & { status: StatusLicenca };
      observacoes: string | null;
    }
  | {
      tipo: "licenca_alterada";
      chave: string;
      licenca_id: string;
      orgao: Orgao;
      cnae: string | null;
      descricao: string;
      campos: Diferenca[];
    }
  | {
      tipo: "licenca_igual";
      chave: string;
      licenca_id: string;
      orgao: Orgao;
      cnae: string | null;
      descricao: string;
    }
  | {
      tipo: "licenca_ausente";
      chave: string;
      licenca_id: string;
      orgao: Orgao;
      cnae: string | null;
      descricao: string;
    };

export type AnaliseCertificado = {
  unidade_id: string;
  documento_id: string | null;
  /** Dados de identificação lidos no PDF, para conferência antes de aplicar. */
  cabecalho: { cnpj: string | null; nome: string | null; emitido_em: string | null };
  linhas: LinhaAnalise[];
  avisos: string[];
};

export function resumoAnalise(linhas: LinhaAnalise[]) {
  const conta = (t: LinhaAnalise["tipo"]) => linhas.filter((l) => l.tipo === t).length;
  return {
    novas: conta("licenca_nova"),
    alteradas: conta("licenca_alterada"),
    iguais: conta("licenca_igual"),
    ausentes: conta("licenca_ausente"),
    cnaes: conta("cnae_novo"),
  };
}

/** Só estes tipos de linha podem ser gravados. */
export type LinhaAplicavel = Extract<
  LinhaAnalise,
  { tipo: "cnae_novo" | "licenca_nova" | "licenca_alterada" }
>;

/** Linhas que podem ser aplicadas (as "ausentes" nunca são tocadas). */
export function linhasAplicaveis(linhas: LinhaAnalise[]): LinhaAplicavel[] {
  return linhas.filter(
    (l): l is LinhaAplicavel =>
      l.tipo === "cnae_novo" || l.tipo === "licenca_nova" || l.tipo === "licenca_alterada",
  );
}
