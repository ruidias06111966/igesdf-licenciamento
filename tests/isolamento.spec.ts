import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda do isolamento entre empresas.
 *
 * O filtro por empresa está escrito num sítio só, em `escopo.server.ts`. O que
 * falha não é escrevê-lo mal — é esquecê-lo numa função nova daqui a seis
 * meses, e ninguém reparar, porque sub-filtrar não dá erro nenhum: mostra
 * simplesmente os dados de outro cliente.
 *
 * Este teste percorre o código e reprova quando uma função de servidor toca
 * numa tabela de cliente sem que o ficheiro use o escopo. Não prova que o
 * filtro está certo; prova que não foi esquecido, que é a falha provável.
 */

/** Tabelas cujas linhas pertencem a um cliente. */
const TABELAS_DE_CLIENTE = [
  "unidades",
  "licencas",
  "documentos",
  "cnaes_unidade",
  "responsaveis_tecnicos",
  "processos_sei",
  "processo_itens",
  "checklist_itens",
  "v_licencas_dashboard",
  "atividade_log",
  "validacao_execucoes",
  "ia_modelos",
  "notificacoes_vencimento",
];

/**
 * Ficheiros onde o acesso sem escopo é legítimo, com a razão.
 * Acrescentar aqui é uma decisão consciente, não um atalho.
 */
const DISPENSADOS: Record<string, string> = {
  "src/lib/escopo.server.ts": "é o próprio módulo que aplica o filtro",
  "src/lib/acesso.server.ts": "resolve a identidade antes de haver escopo",
  "src/lib/acesso.functions.ts": "gere contas, que não pertencem a nenhuma empresa",
  "src/lib/mcp/auth.ts": "resolve o escopo da chamada MCP a partir do e-mail",
  "src/lib/auditoria.server.ts":
    "só escreve, e grava a empresa da própria sessão em cada linha; não lê nada para mostrar",
  "src/routes/api/public/hooks/enviar-alertas.ts":
    "corre como rotina do sistema, sem sessão, e envia a cada unidade os alertas das suas próprias licenças",
};

function ficheirosTs(raiz: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(raiz)) {
    const caminho = join(raiz, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...ficheirosTs(caminho));
    } else if (/\.tsx?$/.test(nome) && !nome.endsWith(".d.ts")) {
      saida.push(caminho);
    }
  }
  return saida;
}

test.describe("isolamento entre empresas", () => {
  test("nenhuma função de servidor lê tabelas de cliente sem o escopo", () => {
    const padraoTabela = new RegExp(`\\.from\\("(${TABELAS_DE_CLIENTE.join("|")})"\\)`);
    const faltam: string[] = [];

    for (const caminho of ficheirosTs("src")) {
      const relativo = caminho.replace(/\\/g, "/");
      if (DISPENSADOS[relativo]) continue;
      if (relativo.endsWith("types.ts")) continue;

      const fonte = readFileSync(caminho, "utf8");
      if (!padraoTabela.test(fonte)) continue;

      // Chega que o ficheiro use o escopo: cada função nele foi conferida à
      // mão, e o que este teste apanha é o ficheiro novo que não o usa de todo.
      const usaEscopo =
        fonte.includes("@/lib/escopo.server") || fonte.includes('from "../escopo.server"');
      if (!usaEscopo) faltam.push(relativo);
    }

    expect(
      faltam,
      `Estes ficheiros tocam em tabelas de cliente sem usar o escopo:\n  ${faltam.join("\n  ")}\n\n` +
        "Use os utilitários de src/lib/escopo.server.ts, ou acrescente o ficheiro a " +
        "DISPENSADOS neste teste com a razão pela qual não precisa de filtro.",
    ).toEqual([]);
  });

  test("o escopo recusa quem não tem empresa nem é master global", async () => {
    const { escopoDaSessao } = await import("../src/lib/escopo.server");

    const semEmpresa = {
      userId: "u1",
      email: "a@b.pt",
      nome: null,
      perfil: "leitura" as const,
      suspenso: false,
      empresaId: null,
    };
    // O ponto do teste: um perfil autorizado sem empresa não pode cair em
    // "vê tudo". Tem de rebentar.
    expect(() => escopoDaSessao(semEmpresa)).toThrow(/não está associada/i);

    const masterGlobal = { ...semEmpresa, perfil: "master" as const };
    expect(escopoDaSessao(masterGlobal)).toEqual({ global: true, empresaId: null });

    const daEmpresa = { ...semEmpresa, empresaId: "e1" };
    expect(escopoDaSessao(daEmpresa)).toEqual({ global: false, empresaId: "e1" });
  });
});
