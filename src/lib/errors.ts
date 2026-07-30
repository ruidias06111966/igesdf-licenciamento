/**
 * Traduz erros técnicos (Supabase, RLS, middleware de autenticação, rede) para
 * mensagens que um gestor de compliance consegue agir sobre. As páginas antes
 * despejavam `error.message` cru no ecrã, incluindo textos como
 * "Unauthorized: No authorization header provided".
 */

type MensagemAmigavel = { titulo: string; detalhe: string; podeTentarNovamente: boolean };

const PADROES: { teste: RegExp; resposta: MensagemAmigavel }[] = [
  {
    teste: /unauthorized|acesso não autorizado|jwt|invalid token|no authorization header/i,
    resposta: {
      titulo: "Acesso expirado",
      detalhe: "Informe a senha de acesso novamente para continuar. Nenhum dado foi alterado.",
      podeTentarNovamente: false,
    },
  },
  {
    teste: /row-level security|permission denied|not authorized|forbidden/i,
    resposta: {
      titulo: "Operação recusada pelo banco de dados",
      detalhe:
        "O servidor não tem permissão para esta escrita. Confirme se SUPABASE_SERVICE_ROLE_KEY está configurada no ambiente.",
      podeTentarNovamente: false,
    },
  },
  {
    teste: /duplicate key|already exists|unique constraint/i,
    resposta: {
      titulo: "Registro duplicado",
      detalhe: "Já existe um registro com estes dados. Verifique antes de salvar novamente.",
      podeTentarNovamente: false,
    },
  },
  {
    teste: /foreign key|violates foreign key constraint/i,
    resposta: {
      titulo: "Registro em uso",
      detalhe: "Existem registros vinculados a este item. Remova-os primeiro.",
      podeTentarNovamente: false,
    },
  },
  {
    teste: /failed to fetch|network|econnrefused|timeout|aborted/i,
    resposta: {
      titulo: "Falha de conexão",
      detalhe: "Não foi possível falar com o servidor. Verifique a internet e tente novamente.",
      podeTentarNovamente: true,
    },
  },
  {
    teste: /missing supabase environment|SUPABASE_SERVICE_ROLE_KEY/i,
    resposta: {
      titulo: "Configuração do banco de dados incompleta",
      detalhe:
        "Falta a variável de ambiente SUPABASE_SERVICE_ROLE_KEY. É com ela que o servidor lê e grava os dados. Defina-a nas configurações do projeto e recarregue a página.",
      podeTentarNovamente: false,
    },
  },
  {
    teste: /não encontrada|not found/i,
    resposta: {
      titulo: "Registro não encontrado",
      detalhe: "O item pode ter sido removido por outro usuário.",
      podeTentarNovamente: false,
    },
  },
  {
    teste: /ACESSO_SENHA/i,
    resposta: {
      titulo: "Senha de acesso não configurada",
      detalhe:
        "Defina a variável de ambiente ACESSO_SENHA nas configurações do projeto para liberar a entrada.",
      podeTentarNovamente: false,
    },
  },
  {
    teste: /limite de 25 MB|arquivo acima/i,
    resposta: {
      titulo: "Arquivo muito grande",
      detalhe: "O limite por arquivo é de 25 MB. Compacte o documento e tente novamente.",
      podeTentarNovamente: false,
    },
  },
];

function textoDoErro(erro: unknown): string {
  if (typeof erro === "string") return erro;
  if (erro instanceof Error) return erro.message;
  if (erro && typeof erro === "object" && "message" in erro) {
    return String((erro as { message: unknown }).message);
  }
  return "";
}

export function descreverErro(erro: unknown): MensagemAmigavel {
  const texto = textoDoErro(erro);
  const conhecido = PADROES.find((p) => p.teste.test(texto));
  if (conhecido) return conhecido.resposta;
  return {
    titulo: "Não foi possível concluir a operação",
    detalhe: texto || "Ocorreu um erro inesperado. Tente novamente em alguns instantes.",
    podeTentarNovamente: true,
  };
}

/** Mensagem de uma linha, para toasts. */
export function mensagemErro(erro: unknown): string {
  const { titulo, detalhe } = descreverErro(erro);
  return detalhe && detalhe !== titulo ? `${titulo}: ${detalhe}` : titulo;
}
