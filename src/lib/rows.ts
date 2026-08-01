/**
 * Tipos das linhas do banco, derivados dos tipos gerados pelo Supabase.
 * Substituem os `any` que circulavam entre páginas e formulários.
 */
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type Unidade = Tables["unidades"]["Row"];
export type Licenca = Tables["licencas"]["Row"];
export type ResponsavelTecnico = Tables["responsaveis_tecnicos"]["Row"];
export type Documento = Tables["documentos"]["Row"];
export type CnaeUnidade = Tables["cnaes_unidade"]["Row"];
export type ChecklistItem = Tables["checklist_itens"]["Row"];
export type Orgao_ = Tables["orgaos"]["Row"];
export type Normativa = Tables["normativas"]["Row"];
export type ProcessoSei = Tables["processos_sei"]["Row"];
export type ProcessoItem = Tables["processo_itens"]["Row"];

/** Processo com a unidade aninhada e o resumo do checklist (listProcessos). */
export type ProcessoLista = ProcessoSei & {
  unidades: { id: string; nome: string; tipo: Unidade["tipo"] } | null;
  resumo: { total: number; concluidos: number; pendentes: number };
};

/** Linha da view do painel: licença + dados da unidade + semáforo calculado. */
export type LicencaDashboard = Views["v_licencas_dashboard"]["Row"];

/** Item de checklist com a licença e a unidade aninhadas (listProximosPassos). */
export type ProximoPasso = Pick<
  ChecklistItem,
  "id" | "titulo" | "status" | "responsavel" | "data_conclusao" | "ordem"
> & {
  licencas: {
    id: string;
    orgao: Licenca["orgao"];
    unidade_id: string;
    data_vencimento: string | null;
    descricao: string | null;
    unidades: { id: string; nome: string } | null;
  } | null;
};

/** Item de checklist com o órgão da licença (getDossieUnidade). */
export type ChecklistItemDossie = ChecklistItem & {
  licencas: { unidade_id: string; orgao: Licenca["orgao"] } | null;
};

export type DossieUnidade = {
  unidade: Unidade;
  licencas: Licenca[];
  responsaveis: ResponsavelTecnico[];
  documentos: Documento[];
  cnaes: CnaeUnidade[];
  checklist: ChecklistItemDossie[];
};

export type FichaUnidade = {
  unidade: Unidade;
  licencas: Licenca[];
  responsaveis: ResponsavelTecnico[];
  documentos: Documento[];
  cnaes: CnaeUnidade[];
};
