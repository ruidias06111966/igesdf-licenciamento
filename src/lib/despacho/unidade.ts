/** Montagem do despacho de licenciamento de uma unidade. */
import {
  CLASSE_LABEL,
  SITUACAO_LABEL,
  RESPONSAVEL_LABEL,
  dataBr,
  responsavel,
  sigla,
  vencida,
  type Bloco,
  type ItemDespacho,
} from "@/lib/despacho/nucleo";

export type CamposDespacho = {
  numero: string;
  processo_sei: string;
  destinatario: string;
  assunto: string;
  certificado_data: string;
  certificado_codigo: string;
  area_m2: string;
  restricao_viabilidade: string;
  providencias: string;
  local: string;
  assinantes: { nome: string; cargo: string }[];
};

export type UnidadeDespacho = {
  nome: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  regiao_administrativa?: string | null;
  cnes?: string | null;
  situacao_edificacao?: string | null;
};

function situacaoTexto(item: ItemDespacho): string {
  if (item.classe === "licenciada") {
    return vencida(item) ? "Licenciada — validade expirada" : "Licenciada";
  }
  if (item.classe === "dispensada") return CLASSE_LABEL.dispensada;
  return item.situacao ? SITUACAO_LABEL[item.situacao] : CLASSE_LABEL.nao_licenciada;
}

export function montarDespachoUnidade(entrada: {
  unidade: UnidadeDespacho;
  itens: ItemDespacho[];
  campos: CamposDespacho;
}): Bloco[] {
  const { unidade, itens, campos } = entrada;
  const blocos: Bloco[] = [];
  const nome = unidade.nome_fantasia?.trim() || unidade.nome;
  const endereco = [unidade.endereco, unidade.bairro, unidade.regiao_administrativa]
    .filter(Boolean)
    .join(", ");

  blocos.push({ t: "titulo", texto: `DESPACHO Nº ${campos.numero || "___"} — NUCON/IGESDF` });
  blocos.push({
    t: "p",
    texto: `**Processo SEI:** ${campos.processo_sei || "—"}  |  **Ao(À):** ${
      campos.destinatario || "—"
    }`,
  });
  blocos.push({ t: "p", texto: `**Assunto:** ${campos.assunto || `Licenciamento — ${nome}`}` });

  blocos.push({ t: "titulo", texto: "1. Do objeto" });
  blocos.push({
    t: "p",
    texto:
      `Trata-se da situação de licenciamento da unidade **${nome}**` +
      (unidade.cnpj ? `, inscrita no CNPJ nº ${unidade.cnpj}` : "") +
      (endereco ? `, situada em ${endereco}` : "") +
      (unidade.cnes ? `, CNES nº ${unidade.cnes}` : "") +
      (campos.certificado_data
        ? `, conforme Certificado de Licenciamento emitido pela RedeSim/DF em ${dataBr(
            campos.certificado_data,
          )}`
        : "") +
      (campos.certificado_codigo ? ` (código de validação ${campos.certificado_codigo})` : "") +
      ".",
  });
  if (campos.area_m2.trim()) {
    blocos.push({
      t: "p",
      texto: `A edificação possui área declarada de ${campos.area_m2} m², parâmetro relevante para as exigências de segurança contra incêndio e pânico junto ao CBMDF.`,
    });
  }
  if (unidade.situacao_edificacao && unidade.situacao_edificacao !== "operando") {
    blocos.push({
      t: "p",
      texto: `Regista-se que a edificação se encontra na condição de **${unidade.situacao_edificacao}**, o que condiciona a sequência dos licenciamentos (projeto aprovado e habite-se antes do licenciamento sanitário).`,
    });
  }
  if (campos.restricao_viabilidade.trim()) {
    blocos.push({
      t: "p",
      texto: `**Viabilidade / restrições:** ${campos.restricao_viabilidade.trim()}`,
    });
  }

  blocos.push({ t: "titulo", texto: "2. Das atividades e da situação por órgão" });
  blocos.push({
    t: "tabela",
    cab: ["Órgão", "CNAE", "Atividade", "Situação", "Validade", "Responsabilidade"],
    linhas: itens.map((i) => [
      sigla(i.orgao),
      i.cnae || "—",
      i.cnae_desc || "—",
      situacaoTexto(i),
      dataBr(i.validade),
      RESPONSAVEL_LABEL[responsavel(i)],
    ]),
  });

  const licenciadas = itens.filter((i) => i.classe === "licenciada" && !vencida(i));
  const dispensadas = itens.filter((i) => i.classe === "dispensada");
  const expiradas = itens.filter((i) => vencida(i));
  const noOrgao = itens.filter((i) => responsavel(i) === "orgao");
  const noIges = itens.filter((i) => responsavel(i) === "igesdf" && !vencida(i));
  const indeferidas = itens.filter((i) => i.situacao === "indeferida");

  blocos.push({ t: "titulo", texto: "3. Da análise" });
  blocos.push({
    t: "p",
    texto: `Das ${itens.length} atividades analisadas, ${licenciadas.length} encontram-se licenciadas, ${dispensadas.length} dispensadas de licenciamento e ${
      itens.length - licenciadas.length - dispensadas.length
    } sem licença emitida.`,
  });
  if (expiradas.length) {
    blocos.push({
      t: "p",
      texto: `**Atenção:** ${expiradas.length} licença(s) com validade expirada — ${expiradas
        .map((i) => `${sigla(i.orgao)} / ${i.cnae || "s/ CNAE"} (venceu em ${dataBr(i.validade)})`)
        .join("; ")}. A renovação sanitária deve ser protocolada com, no mínimo, 60 dias de antecedência.`,
    });
  }
  if (indeferidas.length) {
    blocos.push({
      t: "p",
      texto: `Regista-se indeferimento em ${indeferidas
        .map((i) => `${sigla(i.orgao)} / ${i.cnae || "s/ CNAE"}`)
        .join("; ")}, cabendo ao IGESDF apresentar defesa ou sanear as exigências apontadas.`,
    });
  }
  if (noOrgao.length) {
    blocos.push({
      t: "p",
      texto: `Encontram-se pendentes de manifestação do órgão licenciador: ${noOrgao
        .map((i) => `${sigla(i.orgao)} / ${i.cnae || "s/ CNAE"}`)
        .join("; ")}.`,
    });
  }
  if (noIges.length) {
    blocos.push({
      t: "p",
      texto: `Dependem de providência interna do IGESDF: ${noIges
        .map((i) => `${sigla(i.orgao)} / ${i.cnae || "s/ CNAE"}`)
        .join("; ")}.`,
    });
  }

  const providencias = campos.providencias
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  blocos.push({ t: "titulo", texto: "4. Das providências" });
  if (providencias.length) {
    blocos.push({ t: "lista", itens: providencias });
  } else {
    blocos.push({
      t: "p",
      texto: "Sem providências adicionais a registar nesta data.",
    });
  }

  blocos.push({
    t: "assinatura",
    local: campos.local || `Brasília/DF, ${dataBr(new Date().toISOString().slice(0, 10))}.`,
    linhas: campos.assinantes.filter((a) => a.nome.trim()),
  });

  return blocos;
}