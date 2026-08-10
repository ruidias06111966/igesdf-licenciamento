import { semaforoColor } from "@/lib/domain";
import type { LicencaDashboard } from "@/lib/rows";

/**
 * Agregação da matriz de compliance (unidade × órgão).
 *
 * Vive fora do componente para poder ser testada sozinha: é aqui que está a
 * regra que decide o que cada célula mostra, e um engano aqui faria a matriz
 * apresentar uma unidade como regular quando tem licença vencida.
 */

export type Celula = {
  licencas: LicencaDashboard[];
  /** A licença mais urgente do cruzamento — é ela que dá cor à célula. */
  pior: LicencaDashboard | null;
};

/** Menor peso = mais urgente. Empate resolve-se pelo vencimento mais próximo. */
export function piorLicenca(lista: LicencaDashboard[]): LicencaDashboard | null {
  if (lista.length === 0) return null;
  return [...lista].sort((a, b) => {
    const pa = semaforoColor(a.semaforo ?? "").peso;
    const pb = semaforoColor(b.semaforo ?? "").peso;
    if (pa !== pb) return pa - pb;
    return (a.data_vencimento ?? "9999-12-31").localeCompare(b.data_vencimento ?? "9999-12-31");
  })[0]!;
}

/** unidade_id → orgao → célula. */
export type Grade = Map<string, Map<string, Celula>>;

export function montarGrade(licencas: LicencaDashboard[]): Grade {
  const grade: Grade = new Map();
  for (const l of licencas) {
    if (!l.unidade_id || !l.orgao) continue;
    const porOrgao = grade.get(l.unidade_id) ?? new Map<string, Celula>();
    const celula = porOrgao.get(l.orgao) ?? { licencas: [], pior: null };
    celula.licencas.push(l);
    porOrgao.set(l.orgao, celula);
    grade.set(l.unidade_id, porOrgao);
  }
  for (const porOrgao of grade.values()) {
    for (const celula of porOrgao.values()) celula.pior = piorLicenca(celula.licencas);
  }
  return grade;
}

/**
 * Uma unidade tem pendência quando algum cruzamento não está regular, ou quando
 * falta licença num órgão que as outras unidades já têm — a ausência de registo
 * é, ela própria, uma pendência de diagnóstico.
 */
export function temPendencia(
  unidadeId: string,
  grade: Grade,
  orgaosUsados: readonly string[],
): boolean {
  const porOrgao = grade.get(unidadeId);
  if (!porOrgao) return true;
  for (const celula of porOrgao.values()) {
    // peso <= 4 cobre vencida, crítico, alerta, indeferida e os estados em aberto.
    if (semaforoColor(celula.pior?.semaforo ?? "").peso <= 4) return true;
  }
  return orgaosUsados.some((o) => !porOrgao.has(o));
}
