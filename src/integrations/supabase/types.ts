export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      atividade_log: {
        Row: {
          acao: string
          alteracoes: Json | null
          created_at: string
          detalhes: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          perfil: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          alteracoes?: Json | null
          created_at?: string
          detalhes?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          perfil?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          alteracoes?: Json | null
          created_at?: string
          detalhes?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          perfil?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      checklist_itens: {
        Row: {
          concluido_por: string | null
          created_at: string
          data_conclusao: string | null
          descricao: string | null
          id: string
          licenca_id: string
          observacoes: string | null
          ordem: number
          responsavel: string | null
          status: string
          template_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          concluido_por?: string | null
          created_at?: string
          data_conclusao?: string | null
          descricao?: string | null
          id?: string
          licenca_id: string
          observacoes?: string | null
          ordem?: number
          responsavel?: string | null
          status?: string
          template_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          concluido_por?: string | null
          created_at?: string
          data_conclusao?: string | null
          descricao?: string | null
          id?: string
          licenca_id?: string
          observacoes?: string | null
          ordem?: number
          responsavel?: string | null
          status?: string
          template_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "licencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_itens_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "v_licencas_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_itens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          obrigatorio: boolean
          ordem: number
          orgao: Database["public"]["Enums"]["orgao_licenciador"]
          responsavel_padrao: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          ordem: number
          orgao: Database["public"]["Enums"]["orgao_licenciador"]
          responsavel_padrao?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          ordem?: number
          orgao?: Database["public"]["Enums"]["orgao_licenciador"]
          responsavel_padrao?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      cnaes_unidade: {
        Row: {
          cnpj_ses_legado: string | null
          codigo: string
          created_at: string
          data_vencimento: string | null
          descricao: string
          id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["status_licenca"]
          unidade_id: string
          updated_at: string
        }
        Insert: {
          cnpj_ses_legado?: string | null
          codigo: string
          created_at?: string
          data_vencimento?: string | null
          descricao: string
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_licenca"]
          unidade_id: string
          updated_at?: string
        }
        Update: {
          cnpj_ses_legado?: string | null
          codigo?: string
          created_at?: string
          data_vencimento?: string | null
          descricao?: string
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_licenca"]
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnaes_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      config_rotina: {
        Row: {
          ativo: boolean
          fuso: string
          hora: number
          id: string
          minuto: number
          ultima_execucao: string | null
          ultimo_total: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          fuso?: string
          hora?: number
          id: string
          minuto?: number
          ultima_execucao?: string | null
          ultimo_total?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          fuso?: string
          hora?: number
          id?: string
          minuto?: number
          ultima_execucao?: string | null
          ultimo_total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          ativo: boolean
          categoria: string
          comentario_versao: string | null
          created_at: string
          data_validade: string | null
          descricao: string | null
          documento_pai_id: string | null
          id: string
          licenca_id: string | null
          mime_type: string | null
          nome: string
          processo_id: string | null
          processo_item_id: string | null
          storage_path: string
          tamanho_bytes: number | null
          unidade_id: string | null
          uploaded_by: string | null
          versao: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          comentario_versao?: string | null
          created_at?: string
          data_validade?: string | null
          descricao?: string | null
          documento_pai_id?: string | null
          id?: string
          licenca_id?: string | null
          mime_type?: string | null
          nome: string
          processo_id?: string | null
          processo_item_id?: string | null
          storage_path: string
          tamanho_bytes?: number | null
          unidade_id?: string | null
          uploaded_by?: string | null
          versao?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          comentario_versao?: string | null
          created_at?: string
          data_validade?: string | null
          descricao?: string | null
          documento_pai_id?: string | null
          id?: string
          licenca_id?: string | null
          mime_type?: string | null
          nome?: string
          processo_id?: string | null
          processo_item_id?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
          unidade_id?: string | null
          uploaded_by?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_documento_pai_id_fkey"
            columns: ["documento_pai_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "licencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "v_licencas_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_sei"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_processo_item_id_fkey"
            columns: ["processo_item_id"]
            isOneToOne: false
            referencedRelation: "processo_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_modelo_versoes: {
        Row: {
          comentario: string | null
          conteudo: string
          created_at: string
          id: string
          modelo_id: string
          perfil: string | null
          titulo: string
          versao: number
        }
        Insert: {
          comentario?: string | null
          conteudo: string
          created_at?: string
          id?: string
          modelo_id: string
          perfil?: string | null
          titulo: string
          versao: number
        }
        Update: {
          comentario?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          modelo_id?: string
          perfil?: string | null
          titulo?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ia_modelo_versoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "ia_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_modelos: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          observacoes: string | null
          orgao: Database["public"]["Enums"]["orgao_licenciador"] | null
          processo_id: string | null
          tags: string[]
          tipo: string
          tipo_unidade: Database["public"]["Enums"]["tipo_unidade"] | null
          titulo: string
          unidade_id: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          observacoes?: string | null
          orgao?: Database["public"]["Enums"]["orgao_licenciador"] | null
          processo_id?: string | null
          tags?: string[]
          tipo?: string
          tipo_unidade?: Database["public"]["Enums"]["tipo_unidade"] | null
          titulo: string
          unidade_id?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          orgao?: Database["public"]["Enums"]["orgao_licenciador"] | null
          processo_id?: string | null
          tags?: string[]
          tipo?: string
          tipo_unidade?: Database["public"]["Enums"]["tipo_unidade"] | null
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ia_modelos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_sei"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_modelos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_uso: {
        Row: {
          acao: string
          criado_em: string
          id: string
          perfil: string
          tokens_entrada: number
          tokens_saida: number
        }
        Insert: {
          acao: string
          criado_em?: string
          id?: string
          perfil: string
          tokens_entrada?: number
          tokens_saida?: number
        }
        Update: {
          acao?: string
          criado_em?: string
          id?: string
          perfil?: string
          tokens_entrada?: number
          tokens_saida?: number
        }
        Relationships: []
      }
      licencas: {
        Row: {
          created_at: string
          data_emissao: string | null
          data_protocolo: string | null
          data_vencimento: string | null
          descricao: string | null
          id: string
          numero: string | null
          observacoes: string | null
          orgao: Database["public"]["Enums"]["orgao_licenciador"]
          processo_sei: string | null
          status: Database["public"]["Enums"]["status_licenca"]
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_emissao?: string | null
          data_protocolo?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          numero?: string | null
          observacoes?: string | null
          orgao: Database["public"]["Enums"]["orgao_licenciador"]
          processo_sei?: string | null
          status?: Database["public"]["Enums"]["status_licenca"]
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_emissao?: string | null
          data_protocolo?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          numero?: string | null
          observacoes?: string | null
          orgao?: Database["public"]["Enums"]["orgao_licenciador"]
          processo_sei?: string | null
          status?: Database["public"]["Enums"]["status_licenca"]
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licencas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      normativas: {
        Row: {
          ambito: string
          ano: number | null
          aplicacao: string[]
          created_at: string
          data_publicacao: string | null
          ementa: string | null
          id: string
          link: string | null
          numero: string
          observacoes: string | null
          orgao_sigla: string
          principal: boolean
          situacao: string
          storage_path: string | null
          tags: string[]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ambito?: string
          ano?: number | null
          aplicacao?: string[]
          created_at?: string
          data_publicacao?: string | null
          ementa?: string | null
          id?: string
          link?: string | null
          numero: string
          observacoes?: string | null
          orgao_sigla?: string
          principal?: boolean
          situacao?: string
          storage_path?: string | null
          tags?: string[]
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ambito?: string
          ano?: number | null
          aplicacao?: string[]
          created_at?: string
          data_publicacao?: string | null
          ementa?: string | null
          id?: string
          link?: string | null
          numero?: string
          observacoes?: string | null
          orgao_sigla?: string
          principal?: boolean
          situacao?: string
          storage_path?: string | null
          tags?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes_vencimento: {
        Row: {
          destinatario: string
          dias_antes: number
          enviado_em: string
          id: string
          licenca_id: string
        }
        Insert: {
          destinatario: string
          dias_antes: number
          enviado_em?: string
          id?: string
          licenca_id: string
        }
        Update: {
          destinatario?: string
          dias_antes?: number
          enviado_em?: string
          id?: string
          licenca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_vencimento_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "licencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_vencimento_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "v_licencas_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      orgaos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          sigla: string
          site: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          sigla: string
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          sigla?: string
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      perfis_acesso: {
        Row: {
          autorizado_em: string | null
          autorizado_por: string | null
          created_at: string
          email: string
          nome: string | null
          perfil: string | null
          suspenso: boolean
          ultimo_acesso: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          created_at?: string
          email: string
          nome?: string | null
          perfil?: string | null
          suspenso?: boolean
          ultimo_acesso?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          created_at?: string
          email?: string
          nome?: string | null
          perfil?: string | null
          suspenso?: boolean
          ultimo_acesso?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      processo_checklist_templates: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          obrigatorio: boolean
          ordem: number
          orgao: Database["public"]["Enums"]["orgao_licenciador"]
          responsavel_padrao: string | null
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          ordem: number
          orgao: Database["public"]["Enums"]["orgao_licenciador"]
          responsavel_padrao?: string | null
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          ordem?: number
          orgao?: Database["public"]["Enums"]["orgao_licenciador"]
          responsavel_padrao?: string | null
          titulo?: string
        }
        Relationships: []
      }
      processo_itens: {
        Row: {
          created_at: string
          data_entrega: string | null
          descricao: string | null
          id: string
          obrigatorio: boolean
          observacoes: string | null
          ordem: number
          orgao: Database["public"]["Enums"]["orgao_licenciador"] | null
          prazo: string | null
          processo_id: string
          responsavel: string | null
          situacao: string
          template_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_entrega?: string | null
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          observacoes?: string | null
          ordem?: number
          orgao?: Database["public"]["Enums"]["orgao_licenciador"] | null
          prazo?: string | null
          processo_id: string
          responsavel?: string | null
          situacao?: string
          template_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_entrega?: string | null
          descricao?: string | null
          id?: string
          obrigatorio?: boolean
          observacoes?: string | null
          ordem?: number
          orgao?: Database["public"]["Enums"]["orgao_licenciador"] | null
          prazo?: string | null
          processo_id?: string
          responsavel?: string | null
          situacao?: string
          template_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processo_itens_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_sei"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processo_itens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "processo_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_sei: {
        Row: {
          assunto: string | null
          ativo: boolean
          created_at: string
          data_abertura: string | null
          data_conclusao: string | null
          id: string
          licenca_id: string | null
          link: string | null
          numero: string
          observacoes: string | null
          orgao: Database["public"]["Enums"]["orgao_licenciador"] | null
          responsavel: string | null
          situacao: string
          tipo: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          assunto?: string | null
          ativo?: boolean
          created_at?: string
          data_abertura?: string | null
          data_conclusao?: string | null
          id?: string
          licenca_id?: string | null
          link?: string | null
          numero: string
          observacoes?: string | null
          orgao?: Database["public"]["Enums"]["orgao_licenciador"] | null
          responsavel?: string | null
          situacao?: string
          tipo?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          assunto?: string | null
          ativo?: boolean
          created_at?: string
          data_abertura?: string | null
          data_conclusao?: string | null
          id?: string
          licenca_id?: string | null
          link?: string | null
          numero?: string
          observacoes?: string | null
          orgao?: Database["public"]["Enums"]["orgao_licenciador"] | null
          responsavel?: string | null
          situacao?: string
          tipo?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_sei_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "licencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_sei_licenca_id_fkey"
            columns: ["licenca_id"]
            isOneToOne: false
            referencedRelation: "v_licencas_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_sei_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis_tecnicos: {
        Row: {
          ativo: boolean
          cargo: string | null
          conselho: string | null
          cpf: string | null
          created_at: string
          data_inicio: string | null
          email: string | null
          id: string
          nome: string
          numero_registro: string | null
          observacoes: string | null
          telefone: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          data_inicio?: string | null
          email?: string | null
          id?: string
          nome: string
          numero_registro?: string | null
          observacoes?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          data_inicio?: string | null
          email?: string | null
          id?: string
          nome?: string
          numero_registro?: string | null
          observacoes?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsaveis_tecnicos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativa: boolean
          bairro: string | null
          categoria_cnpj: string
          cep: string | null
          cf_df: string | null
          cnae_principal: string | null
          cnae_principal_desc: string | null
          cnaes: string[] | null
          cnes: string | null
          cnpj: string | null
          cnpj_cnes: string | null
          cnpj_ses: string | null
          codigo_mv: string | null
          codigo_mv_nota: string | null
          created_at: string
          endereco: string | null
          id: string
          inicio_atividade: string | null
          nome: string
          nome_fantasia: string | null
          numero_iges: number | null
          observacoes: string | null
          processo_sei: string | null
          regiao_administrativa: string | null
          servicos_especiais: string[] | null
          situacao_edificacao: string | null
          tipo: Database["public"]["Enums"]["tipo_unidade"]
          tipo_estabelecimento: string
          titular_cnes: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          bairro?: string | null
          categoria_cnpj?: string
          cep?: string | null
          cf_df?: string | null
          cnae_principal?: string | null
          cnae_principal_desc?: string | null
          cnaes?: string[] | null
          cnes?: string | null
          cnpj?: string | null
          cnpj_cnes?: string | null
          cnpj_ses?: string | null
          codigo_mv?: string | null
          codigo_mv_nota?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          inicio_atividade?: string | null
          nome: string
          nome_fantasia?: string | null
          numero_iges?: number | null
          observacoes?: string | null
          processo_sei?: string | null
          regiao_administrativa?: string | null
          servicos_especiais?: string[] | null
          situacao_edificacao?: string | null
          tipo?: Database["public"]["Enums"]["tipo_unidade"]
          tipo_estabelecimento?: string
          titular_cnes?: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          bairro?: string | null
          categoria_cnpj?: string
          cep?: string | null
          cf_df?: string | null
          cnae_principal?: string | null
          cnae_principal_desc?: string | null
          cnaes?: string[] | null
          cnes?: string | null
          cnpj?: string | null
          cnpj_cnes?: string | null
          cnpj_ses?: string | null
          codigo_mv?: string | null
          codigo_mv_nota?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          inicio_atividade?: string | null
          nome?: string
          nome_fantasia?: string | null
          numero_iges?: number | null
          observacoes?: string | null
          processo_sei?: string | null
          regiao_administrativa?: string | null
          servicos_especiais?: string[] | null
          situacao_edificacao?: string | null
          tipo?: Database["public"]["Enums"]["tipo_unidade"]
          tipo_estabelecimento?: string
          titular_cnes?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_licencas_dashboard: {
        Row: {
          created_at: string | null
          data_emissao: string | null
          data_protocolo: string | null
          data_vencimento: string | null
          descricao: string | null
          dias_restantes: number | null
          id: string | null
          numero: string | null
          numero_iges: number | null
          observacoes: string | null
          orgao: Database["public"]["Enums"]["orgao_licenciador"] | null
          processo_sei: string | null
          semaforo: string | null
          status: Database["public"]["Enums"]["status_licenca"] | null
          unidade_cnpj: string | null
          unidade_id: string | null
          unidade_nome: string | null
          unidade_tipo: Database["public"]["Enums"]["tipo_unidade"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licencas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      agendar_sincronizacao: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_versao_vigente: { Args: { _doc_id: string }; Returns: undefined }
      sincronizar_licencas_vencidas: {
        Args: { _origem?: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "analista" | "viewer"
      orgao_licenciador:
        | "VISA"
        | "CBMDF"
        | "IBRAM"
        | "SEOP"
        | "PCDF"
        | "SEAGRI"
        | "SEEDF"
        | "DEFESA_CIVIL"
        | "CNES"
        | "ADM_REGIONAL"
        | "CRM"
        | "COREN"
        | "CRF"
        | "CNEN"
        | "ANVISA"
        | "JUCIS"
        | "OUTRO"
        | "DF_LEGAL"
        | "SUSDEC"
      status_licenca:
        | "nao_iniciado"
        | "em_analise"
        | "aguardando_orgao"
        | "vigente"
        | "a_vencer"
        | "vencida"
        | "indeferida"
        | "dispensada"
        | "pendente_declaracao"
        | "em_estudo"
      tipo_unidade:
        | "hospital"
        | "upa"
        | "administrativo"
        | "laboratorio"
        | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "analista", "viewer"],
      orgao_licenciador: [
        "VISA",
        "CBMDF",
        "IBRAM",
        "SEOP",
        "PCDF",
        "SEAGRI",
        "SEEDF",
        "DEFESA_CIVIL",
        "CNES",
        "ADM_REGIONAL",
        "CRM",
        "COREN",
        "CRF",
        "CNEN",
        "ANVISA",
        "JUCIS",
        "OUTRO",
        "DF_LEGAL",
        "SUSDEC",
      ],
      status_licenca: [
        "nao_iniciado",
        "em_analise",
        "aguardando_orgao",
        "vigente",
        "a_vencer",
        "vencida",
        "indeferida",
        "dispensada",
        "pendente_declaracao",
        "em_estudo",
      ],
      tipo_unidade: [
        "hospital",
        "upa",
        "administrativo",
        "laboratorio",
        "outro",
      ],
    },
  },
} as const
