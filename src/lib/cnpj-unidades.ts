/**
 * Quadro de CNPJ / CNES / código SOULMV das unidades do IGESDF.
 *
 * Dados de referência para consulta rápida (Receita Federal + CNES,
 * consulta em 05/08/2026). São cadastrais e estáveis, por isso ficam aqui
 * como constante e não em tabela: nada no sistema os altera.
 */

export const RAIZ_IGESDF = "28.481.233";
export const RAIZ_IGESDF_NUM = "28481233";
export const RAIZ_SES = "00.394.700";
export const RAIZ_SES_NUM = "00394700";

export type CategoriaCnpj = "hospital" | "upa" | "apoio";
export type TitularCnes = "proprio" | "ses" | "sem" | "pendente";

export type UnidadeCnpj = {
  ordem: string;
  dv: string;
  tipo: "Matriz" | "Filial";
  cat: CategoriaCnpj;
  nome: string;
  fantasia: string;
  inicio: string;
  endereco: string;
  bairro: string;
  cep: string;
  cnae: string;
  cnaeDesc: string;
  cnes: string | null;
  cnpjSes: string | null;
  cnpjCnes: string | null;
  titular: TitularCnes;
  mv: string | null;
  mvNota?: string;
};

export const ROTULO_TITULAR: Record<TitularCnes, string> = {
  proprio: "CNPJ IGESDF",
  ses: "CNPJ SES-DF",
  sem: "não se aplica",
  pendente: "a confirmar",
};

export const ROTULO_CATEGORIA: Record<CategoriaCnpj, string> = {
  hospital: "Hospital",
  upa: "UPA",
  apoio: "Apoio",
};

export const UNIDADES_CNPJ: UnidadeCnpj[] = [
  { ordem: "0001", dv: "72", tipo: "Matriz", cat: "hospital", nome: "Hospital de Base do Distrito Federal", fantasia: "IGESDF", inicio: "18/08/2017", endereco: "SMHS Área Especial, Quadra 101", bairro: "Asa Sul", cep: "70335-900", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "0010456", cnpjSes: "0005-31", cnpjCnes: "28.481.233/0001-72", titular: "proprio", mv: "115", mvNota: "compartilhado com PO700 e SIA" },
  { ordem: "0002", dv: "53", tipo: "Filial", cat: "apoio", nome: "Unidade de Distribuição e Logística de Medicamentos", fantasia: "UDLM", inicio: "27/01/2020", endereco: "SIA Trecho 17, Rua 06, Lote 115", bairro: "Zona Industrial (Guará)", cep: "71200-216", cnae: "8660-7/00", cnaeDesc: "Apoio à gestão de saúde", cnes: null, cnpjSes: null, cnpjCnes: null, titular: "sem", mv: "115", mvNota: "compartilhado com HB e PO700" },
  { ordem: "0003", dv: "34", tipo: "Filial", cat: "upa", nome: "UPA de Ceilândia", fantasia: "UPA Ceilândia", inicio: "24/07/2020", endereco: "QNN 27, Lote D", bairro: "Ceilândia Norte", cep: "72225-270", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "7465157", cnpjSes: "0036-38", cnpjCnes: "00.394.700/0036-38", titular: "ses", mv: "434" },
  { ordem: "0004", dv: "15", tipo: "Filial", cat: "upa", nome: "UPA do Recanto das Emas", fantasia: "UPA Recanto", inicio: "24/07/2020", endereco: "Q. 400/600 Subcentro Urbano, Lote 02", bairro: "Recanto das Emas", cep: "72630-250", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "7078730", cnpjSes: "0035-57", cnpjCnes: "00.394.700/0035-57", titular: "ses", mv: "436" },
  { ordem: "0005", dv: "04", tipo: "Filial", cat: "upa", nome: "UPA de Samambaia", fantasia: "UPA Samambaia", inicio: "24/07/2020", endereco: "QS 107, Conjunto 4, Lote 1", bairro: "Samambaia Sul", cep: "72301-524", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "6708714", cnpjSes: "0029-09", cnpjCnes: "00.394.700/0029-09", titular: "ses", mv: "437" },
  { ordem: "0006", dv: "87", tipo: "Filial", cat: "upa", nome: "UPA de São Sebastião", fantasia: "UPA São Sebastião", inicio: "24/07/2020", endereco: "Q. 102, Conjunto 1, AE 1", bairro: "Setor Residencial Oeste", cep: "71692-101", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "7116756", cnpjSes: "0033-95", cnpjCnes: "00.394.700/0033-95", titular: "ses", mv: "438" },
  { ordem: "0007", dv: "68", tipo: "Filial", cat: "apoio", nome: "Administração Geral", fantasia: "Sede administrativa PO700", inicio: "24/07/2020", endereco: "SRTVN Q. 701, Cj. D, Ed. PO700, 3º andar, sala 301", bairro: "Asa Norte", cep: "70719-040", cnae: "8211-3/00", cnaeDesc: "Serviços de escritório e apoio administrativo", cnes: null, cnpjSes: null, cnpjCnes: null, titular: "sem", mv: "115", mvNota: "compartilhado com HB e SIA" },
  { ordem: "0008", dv: "49", tipo: "Filial", cat: "upa", nome: "UPA de Sobradinho", fantasia: "UPA Sobradinho", inicio: "24/07/2020", endereco: "DF-420 km 2, Complexo de Saúde, Lote 1", bairro: "Setor de Mansões de Sobradinho", cep: "73080-050", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "7592477", cnpjSes: "0037-19", cnpjCnes: "00.394.700/0037-19", titular: "ses", mv: "439" },
  { ordem: "0009", dv: "20", tipo: "Filial", cat: "hospital", nome: "Hospital Regional de Santa Maria", fantasia: "HRSM", inicio: "24/07/2020", endereco: "AC 102, Conjuntos A, B, C, D, Lote 1", bairro: "Santa Maria", cep: "72502-100", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "5717515", cnpjSes: "0024-02", cnpjCnes: "28.481.233/0009-20", titular: "proprio", mv: "432" },
  { ordem: "0010", dv: "63", tipo: "Filial", cat: "upa", nome: "UPA do Paranoá", fantasia: "UPA Paranoá", inicio: "30/12/2021", endereco: "Quadra 1/2, Área Especial 4", bairro: "Paranoá Parque", cep: "71587-050", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "0935514", cnpjSes: "0039-80", cnpjCnes: "00.394.700/0039-80", titular: "ses", mv: "880" },
  { ordem: "0011", dv: "44", tipo: "Filial", cat: "upa", nome: "UPA de Ceilândia II", fantasia: "UPA Ceilândia II", inicio: "24/09/2021", endereco: "QNO 21, Lote D", bairro: "Ceilândia Norte", cep: "72262-104", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "0924857", cnpjSes: "0038-08", cnpjCnes: "00.394.700/0038-08", titular: "ses", mv: "879" },
  { ordem: "0012", dv: "25", tipo: "Filial", cat: "upa", nome: "UPA do Gama", fantasia: "UPA Gama", inicio: "30/12/2021", endereco: "QI 07, Área Reservada 2", bairro: "Setor Industrial (Gama)", cep: "72445-070", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "0939145", cnpjSes: "0041-03", cnpjCnes: "00.394.700/0041-03", titular: "ses", mv: "883" },
  { ordem: "0013", dv: "06", tipo: "Filial", cat: "upa", nome: "UPA do Riacho Fundo II", fantasia: "UPA Riacho Fundo II", inicio: "30/12/2021", endereco: "QN 31, Conjunto 3, nº 01", bairro: "Riacho Fundo II", cep: "71880-713", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "0945595", cnpjSes: "0042-86", cnpjCnes: "00.394.700/0042-86", titular: "ses", mv: "881" },
  { ordem: "0014", dv: "97", tipo: "Filial", cat: "upa", nome: "UPA de Brazlândia", fantasia: "UPA Brazlândia", inicio: "07/01/2022", endereco: "Quadra 37, AE 1, nº 01", bairro: "Vila São José (Brazlândia)", cep: "72737-000", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "2840499", cnpjSes: "0044-48", cnpjCnes: "00.394.700/0044-48", titular: "ses", mv: "878" },
  { ordem: "0015", dv: "78", tipo: "Filial", cat: "upa", nome: "UPA de Planaltina", fantasia: "UPA Planaltina", inicio: "07/01/2022", endereco: "Q. 22, Módulo 1, AE 1", bairro: "Setor Hab. Mestre D'Armas", cep: "73404-703", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "0969877", cnpjSes: "0043-67", cnpjCnes: "00.394.700/0043-67", titular: "ses", mv: "882" },
  { ordem: "0016", dv: "59", tipo: "Filial", cat: "upa", nome: "UPA de Vicente Pires", fantasia: "UPA Vicente Pires", inicio: "07/01/2022", endereco: "Rua 10B, Chácara 136, nº 01", bairro: "Setor Hab. Vicente Pires", cep: "72007-240", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "0996068", cnpjSes: "0040-14", cnpjCnes: "00.394.700/0040-14", titular: "ses", mv: "884" },
  { ordem: "0017", dv: "30", tipo: "Filial", cat: "hospital", nome: "Hospital Cidade do Sol", fantasia: "HCSOL", inicio: "03/09/2025", endereco: "Setor N, QNN 27, Lote D", bairro: "Ceilândia", cep: "72225-270", cnae: "8660-7/00", cnaeDesc: "Apoio à gestão de saúde", cnes: null, cnpjSes: null, cnpjCnes: null, titular: "pendente", mv: "1292" },
  { ordem: "0018", dv: "10", tipo: "Filial", cat: "upa", nome: "UPA do Núcleo Bandeirante", fantasia: "UPA Núcleo Bandeirante", inicio: "24/07/2020", endereco: "SPLM Conjunto 1, nº 180", bairro: "Setor Placa da Mercedes", cep: "71732-010", cnae: "8610-1/02", cnaeDesc: "Pronto-socorro e unidades de urgência", cnes: "7111924", cnpjSes: "0034-76", cnpjCnes: "00.394.700/0034-76", titular: "ses", mv: "435" },
];

export const cnpjFormatado = (u: UnidadeCnpj) => `${RAIZ_IGESDF}/${u.ordem}-${u.dv}`;
export const cnpjDigitos = (u: UnidadeCnpj) => `${RAIZ_IGESDF_NUM}${u.ordem}${u.dv}`;
export const sesFormatado = (suf: string | null) => (suf ? `${RAIZ_SES}/${suf}` : null);
export const sesDigitos = (suf: string | null) =>
  suf ? RAIZ_SES_NUM + suf.replace("-", "") : null;

/** Copia texto para a área de transferência, com alternativa para navegadores antigos. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
