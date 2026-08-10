import { expect, test } from "@playwright/test";
import { montarGrade, piorLicenca, temPendencia } from "../src/lib/matriz";
import type { LicencaDashboard } from "../src/lib/rows";

/**
 * Regras da matriz de compliance. É aqui que se decide a cor de cada célula:
 * um engano faria a matriz mostrar uma unidade como regular tendo ela licença
 * vencida — exatamente o erro que a matriz existe para evitar.
 */

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";

function lic(p: Partial<LicencaDashboard>): LicencaDashboard {
  return {
    id: Math.random().toString(36).slice(2),
    unidade_id: U1,
    unidade_nome: "UPA Gama",
    orgao: "VISA",
    descricao: null,
    status: "vigente",
    semaforo: "vigente",
    data_vencimento: null,
    dias_restantes: null,
    numero: null,
    processo_sei: null,
    data_emissao: null,
    data_protocolo: null,
    observacoes: null,
    numero_iges: null,
    unidade_tipo: "upa",
    unidade_cnpj: null,
    created_at: null,
    updated_at: null,
    ...p,
  } as LicencaDashboard;
}

test.describe("piorLicenca", () => {
  test("uma licença vencida ganha a uma vigente no mesmo cruzamento", () => {
    const vencida = lic({ semaforo: "vencida", data_vencimento: "2026-01-10" });
    const vigente = lic({ semaforo: "vigente", data_vencimento: "2027-06-01" });
    expect(piorLicenca([vigente, vencida])?.semaforo).toBe("vencida");
    // A ordem de entrada não pode alterar o resultado.
    expect(piorLicenca([vencida, vigente])?.semaforo).toBe("vencida");
  });

  test("entre dois estados iguais vence a de vencimento mais próximo", () => {
    const cedo = lic({ semaforo: "a_vencer_critico", data_vencimento: "2026-09-01" });
    const tarde = lic({ semaforo: "a_vencer_critico", data_vencimento: "2026-10-01" });
    expect(piorLicenca([tarde, cedo])?.data_vencimento).toBe("2026-09-01");
  });

  test("crítico é mais urgente que alerta, e alerta que vigente", () => {
    const critico = lic({ semaforo: "a_vencer_critico" });
    const alerta = lic({ semaforo: "a_vencer_alerta" });
    const vigente = lic({ semaforo: "vigente" });
    expect(piorLicenca([vigente, alerta, critico])?.semaforo).toBe("a_vencer_critico");
    expect(piorLicenca([vigente, alerta])?.semaforo).toBe("a_vencer_alerta");
  });

  test("licença sem data não ofusca uma vencida", () => {
    const semData = lic({ semaforo: "em_analise", data_vencimento: null });
    const vencida = lic({ semaforo: "vencida", data_vencimento: "2026-01-10" });
    expect(piorLicenca([semData, vencida])?.semaforo).toBe("vencida");
  });

  test("lista vazia devolve nulo", () => {
    expect(piorLicenca([])).toBeNull();
  });
});

test.describe("montarGrade", () => {
  test("agrupa por unidade e órgão, somando as licenças do cruzamento", () => {
    const grade = montarGrade([
      lic({ unidade_id: U1, orgao: "VISA", semaforo: "vencida", data_vencimento: "2026-01-10" }),
      lic({ unidade_id: U1, orgao: "VISA", semaforo: "vigente", data_vencimento: "2027-06-01" }),
      lic({ unidade_id: U1, orgao: "CBMDF", semaforo: "a_vencer_critico" }),
      lic({ unidade_id: U2, orgao: "VISA", semaforo: "vigente" }),
    ]);
    expect(grade.get(U1)?.get("VISA")?.licencas).toHaveLength(2);
    expect(grade.get(U1)?.get("VISA")?.pior?.semaforo).toBe("vencida");
    expect(grade.get(U1)?.get("CBMDF")?.licencas).toHaveLength(1);
    expect(grade.get(U2)?.get("VISA")?.pior?.semaforo).toBe("vigente");
    // Cruzamento sem licença não existe na grade — a célula fica vazia.
    expect(grade.get(U2)?.get("CBMDF")).toBeUndefined();
  });

  test("ignora linhas sem unidade ou sem órgão em vez de as agrupar em branco", () => {
    const grade = montarGrade([
      lic({ unidade_id: null as unknown as string, orgao: "VISA" }),
      lic({ unidade_id: U1, orgao: null as unknown as LicencaDashboard["orgao"] }),
    ]);
    expect(grade.size).toBe(0);
  });
});

test.describe("temPendencia", () => {
  const orgaos = ["VISA", "CBMDF"];

  test("unidade com tudo vigente e completo não tem pendência", () => {
    const grade = montarGrade([
      lic({ unidade_id: U1, orgao: "VISA", semaforo: "vigente" }),
      lic({ unidade_id: U1, orgao: "CBMDF", semaforo: "vigente" }),
    ]);
    expect(temPendencia(U1, grade, orgaos)).toBe(false);
  });

  test("licença vencida marca pendência", () => {
    const grade = montarGrade([
      lic({ unidade_id: U1, orgao: "VISA", semaforo: "vencida" }),
      lic({ unidade_id: U1, orgao: "CBMDF", semaforo: "vigente" }),
    ]);
    expect(temPendencia(U1, grade, orgaos)).toBe(true);
  });

  test("faltar licença num órgão exigido marca pendência", () => {
    const grade = montarGrade([lic({ unidade_id: U1, orgao: "VISA", semaforo: "vigente" })]);
    expect(temPendencia(U1, grade, orgaos)).toBe(true);
  });

  test("unidade sem nenhuma licença marca pendência", () => {
    expect(temPendencia(U2, montarGrade([]), orgaos)).toBe(true);
  });

  test("dispensada não é pendência", () => {
    const grade = montarGrade([
      lic({ unidade_id: U1, orgao: "VISA", semaforo: "vigente" }),
      lic({ unidade_id: U1, orgao: "CBMDF", semaforo: "dispensada" }),
    ]);
    expect(temPendencia(U1, grade, orgaos)).toBe(false);
  });
});
