/** Montagem do despacho consolidado da rede (mensal ou trimestral). */
import {
  RESPONSAVEL_LABEL,
  classificar,
  competenciaLabel,
  dataBr,
  diasEntre,
  hojeIso,
  responsavel,
  sigla,
  vencida,
  type Bloco,
  type ItemDespacho,
} from "@/lib/despacho/nucleo";
import { tipoUnidadeLabel, type Orgao, type StatusLicenca } from "@/lib/domain";

export type UnidadeRede = {
  id: string;
  nome: string;
  nome_fantasia?: string | null;
  tipo: string;
  cnpj?: string | null;
  regiao_administrativa?: string | null;
};

export type LicencaRede = {
  id: string;
  unidade_id: string;
  orgao: string;
  descricao: string | null;
  status: string;
  data_vencimento: string | null;
  updated_at: string;
};

export type ResumoUnidade = {
  unidade: UnidadeRede;
  total: number;
  licenciadas: number;
  dispensadas: number;
  pendentes: number;
  vencidas: number;
  noOrgao: number;
  noIgesdf: number;
  /** Maior tempo (dias) que uma pendência está sem alteração. */
  esperaMaxima: number | null;
  /** Última alteração registada em qualquer licença da unidade. */
  ultimaAtualizacao: string | null;
  alteracoesNaCompetencia: number;
};

function paraItem(l: LicencaRede): ItemDespacho {
  const { classe, situacao } = classificar(l.status as StatusLicenca);
  const cnaeMatch = /([0-9]{4}-?[0-9](?:\/[0-9]{2})?)/.exec(l.descricao ?? "");
  return {
    licenca_id: l.id,
    orgao: l.orgao as Orgao,
    cnae: cnaeMatch?.[1] ?? "",
    cnae_desc: l.descricao ?? "",
    classe,
    situacao,
    validade: l.data_vencimento,
    status: l.status as StatusLicenca,
    atualizado_em: l.updated_at,
  };
}

export function resumirRede(
  unidades: UnidadeRede[],
  licencas: LicencaRede[],
  competencia: { inicio: string; fim: string },
): ResumoUnidade[] {
  const porUnidade = new Map<string, LicencaRede[]>();
  for (const l of licencas) {
    const lista = porUnidade.get(l.unidade_id) ?? [];
    lista.push(l);
    porUnidade.set(l.unidade_id, lista);
  }

  return unidades.map((unidade) => {
    const itens = (porUnidade.get(unidade.id) ?? []).map(paraItem);
    let esperaMaxima: number | null = null;
    let ultimaAtualizacao: string | null = null;
    let alteracoes = 0;
    for (const i of itens) {
      const resp = responsavel(i);
      if (resp !== "resolvido") {
        const dias = diasEntre(i.atualizado_em?.slice(0, 10) ?? null);
        if (dias !== null && (esperaMaxima === null || dias > esperaMaxima)) esperaMaxima = dias;
      }
      const at = i.atualizado_em?.slice(0, 10) ?? null;
      if (at && (!ultimaAtualizacao || at > ultimaAtualizacao)) ultimaAtualizacao = at;
      if (at && at >= competencia.inicio && at <= competencia.fim) alteracoes += 1;
    }
    return {
      unidade,
      total: itens.length,
      licenciadas: itens.filter((i) => i.classe === "licenciada" && !vencida(i)).length,
      dispensadas: itens.filter((i) => i.classe === "dispensada").length,
      pendentes: itens.filter((i) => responsavel(i) !== "resolvido").length,
      vencidas: itens.filter((i) => vencida(i)).length,
      noOrgao: itens.filter((i) => responsavel(i) === "orgao").length,
      noIgesdf: itens.filter((i) => responsavel(i) === "igesdf").length,
      esperaMaxima,
      ultimaAtualizacao,
      alteracoesNaCompetencia: alteracoes,
    };
  });
}

/** Pendências agregadas por órgão, para a secção de interlocução externa. */
export function resumirPorOrgao(licencas: LicencaRede[]) {
  const mapa = new Map<string, { total: number; pendentes: number; vencidas: number }>();
  for (const l of licencas) {
    const item = paraItem(l);
    const linha = mapa.get(l.orgao) ?? { total: 0, pendentes: 0, vencidas: 0 };
    linha.total += 1;
    if (responsavel(item) !== "resolvido") linha.pendentes += 1;
    if (vencida(item)) linha.vencidas += 1;
    mapa.set(l.orgao, linha);
  }
  return [...mapa.entries()]
    .map(([orgao, v]) => ({ orgao, ...v }))
    .sort((a, b) => b.pendentes - a.pendentes || b.total - a.total);
}

export type CamposConsolidado = {
  numero: string;
  processo_sei: string;
  destinatario: string;
  competencia: string;
  periodo: "mensal" | "trimestral";
  /** Dias sem movimento a partir dos quais a espera é destacada. */
  limiteEspera: number;
  observacoes: string;
  local: string;
  assinantes: { nome: string; cargo: string }[];
  secoes: { quadro: boolean; orgaos: boolean; espera: boolean; conferencia: boolean };
};

export function montarConsolidado(entrada: {
  resumos: ResumoUnidade[];
  porOrgao: { orgao: string; total: number; pendentes: number; vencidas: number }[];
  campos: CamposConsolidado;
}): Bloco[] {
  const { resumos, porOrgao, campos } = entrada;
  const blocos: Bloco[] = [];
  const rotuloPeriodo = campos.periodo === "mensal" ? "mensal" : "trimestral";

  const total = resumos.reduce((s, r) => s + r.total, 0);
  const licenciadas = resumos.reduce((s, r) => s + r.licenciadas, 0);
  const dispensadas = resumos.reduce((s, r) => s + r.dispensadas, 0);
  const pendentes = resumos.reduce((s, r) => s + r.pendentes, 0);
  const vencidas = resumos.reduce((s, r) => s + r.vencidas, 0);
  const noOrgao = resumos.reduce((s, r) => s + r.noOrgao, 0);
  const noIgesdf = resumos.reduce((s, r) => s + r.noIgesdf, 0);

  blocos.push({
    t: "titulo",
    texto: `DESPACHO CONSOLIDADO Nº ${campos.numero || "___"} — NUCON/IGESDF`,
  });
  blocos.push({
    t: "p",
    texto: `**Processo SEI:** ${campos.processo_sei || "—"}  |  **Ao(À):** ${
      campos.destinatario || "—"
    }`,
  });
  blocos.push({
    t: "p",
    texto: `**Assunto:** Relatório ${rotuloPeriodo} de licenciamento da rede IGESDF — competência ${competenciaLabel(
      campos.competencia,
    )}.`,
  });

  blocos.push({ t: "titulo", texto: "1. Panorama da rede" });
  blocos.push({
    t: "p",
    texto: `A rede compreende ${resumos.length} unidade(s) em acompanhamento, totalizando ${total} atividade(s) sujeitas a licenciamento. Encontram-se licenciadas ${licenciadas}, dispensadas ${dispensadas} e pendentes ${pendentes}, das quais ${vencidas} com validade expirada. Do total pendente, ${noOrgao} aguardam manifestação dos órgãos licenciadores e ${noIgesdf} dependem de providência interna do IGESDF.`,
  });

  if (campos.secoes.quadro) {
    blocos.push({ t: "titulo", texto: "2. Quadro por unidade" });
    blocos.push({
      t: "tabela",
      cab: [
        "Unidade",
        "Tipo",
        "Total",
        "Licenciadas",
        "Dispensadas",
        "Pendentes",
        "Vencidas",
        "Última atualização",
      ],
      linhas: resumos.map((r) => [
        r.unidade.nome_fantasia?.trim() || r.unidade.nome,
        tipoUnidadeLabel(r.unidade.tipo),
        String(r.total),
        String(r.licenciadas),
        String(r.dispensadas),
        String(r.pendentes),
        String(r.vencidas),
        dataBr(r.ultimaAtualizacao),
      ]),
    });
  }

  if (campos.secoes.orgaos) {
    blocos.push({ t: "titulo", texto: "3. Interlocução por órgão" });
    blocos.push({
      t: "tabela",
      cab: ["Órgão", "Registos", "Pendentes", "Vencidas"],
      linhas: porOrgao.map((o) => [
        sigla(o.orgao),
        String(o.total),
        String(o.pendentes),
        String(o.vencidas),
      ]),
    });
  }

  if (campos.secoes.espera) {
    const demoradas = resumos
      .filter((r) => (r.esperaMaxima ?? 0) >= campos.limiteEspera && r.pendentes > 0)
      .sort((a, b) => (b.esperaMaxima ?? 0) - (a.esperaMaxima ?? 0));
    blocos.push({ t: "titulo", texto: "4. Tempos de espera relevantes" });
    if (demoradas.length) {
      blocos.push({
        t: "lista",
        itens: demoradas.map(
          (r) =>
            `${r.unidade.nome_fantasia?.trim() || r.unidade.nome} — ${r.pendentes} pendência(s), sem movimento há ${r.esperaMaxima} dia(s); responsabilidade predominante: ${
              r.noOrgao >= r.noIgesdf ? RESPONSAVEL_LABEL.orgao : RESPONSAVEL_LABEL.igesdf
            }.`,
        ),
      });
    } else {
      blocos.push({
        t: "p",
        texto: `Nenhuma unidade apresenta pendência sem movimento há mais de ${campos.limiteEspera} dias.`,
      });
    }
  }

  if (campos.secoes.conferencia) {
    const semMovimento = resumos.filter((r) => r.alteracoesNaCompetencia === 0);
    blocos.push({ t: "titulo", texto: "5. Conferência da competência" });
    blocos.push({
      t: "p",
      texto: `Foram registadas ${resumos.reduce(
        (s, r) => s + r.alteracoesNaCompetencia,
        0,
      )} atualização(ões) de licenças na competência ${competenciaLabel(campos.competencia)}.`,
    });
    if (semMovimento.length) {
      blocos.push({
        t: "p",
        texto: `Unidades sem qualquer atualização na competência (certificado eventualmente por atualizar): ${semMovimento
          .map((r) => r.unidade.nome_fantasia?.trim() || r.unidade.nome)
          .join("; ")}.`,
      });
    }
  }

  if (campos.observacoes.trim()) {
    blocos.push({ t: "titulo", texto: "6. Observações e encaminhamentos" });
    blocos.push({
      t: "lista",
      itens: campos.observacoes
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    });
  }

  blocos.push({
    t: "assinatura",
    local: campos.local || `Brasília/DF, ${dataBr(hojeIso())}.`,
    linhas: campos.assinantes.filter((a) => a.nome.trim()),
  });

  return blocos;
}
