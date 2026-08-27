import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { orgaoLabel, statusLabel } from "@/lib/domain";
import type { GrupoProblema, ResultadoValidacao } from "@/lib/validacao";

type Cliente = SupabaseClient<Database>;

/**
 * Conferências de coerência dos dados de licenciamento.
 *
 * Cada conferência responde a uma pergunta que já apareceu na operação real:
 * uma licença "vigente" sem prazo não é conferível; uma licença com prazo
 * passado mas ainda "vigente" engana o semáforo; uma unidade sem CNAEs não
 * consegue produzir a matriz. O resultado traz sempre os registos concretos,
 * para o painel poder corrigir sem obrigar a procurar à mão.
 */
export async function coletarProblemas(supabase: Cliente): Promise<ResultadoValidacao> {
  const hoje = new Date().toISOString().slice(0, 10);

  const [licencas, unidades, cnaes, documentos] = await Promise.all([
    supabase
      .from("licencas")
      .select("id, orgao, descricao, status, data_vencimento, unidade_id, unidades!inner(nome, ativa)")
      .eq("unidades.ativa", true),
    supabase.from("unidades").select("id, nome, tipo, cnpj").eq("ativa", true),
    supabase.from("cnaes_unidade").select("unidade_id"),
    supabase.from("documentos").select("id, nome, unidade_id, categoria").eq("ativo", true),
  ]);
  if (licencas.error) throw licencas.error;
  if (unidades.error) throw unidades.error;
  if (cnaes.error) throw cnaes.error;
  if (documentos.error) throw documentos.error;

  type Linha = (typeof licencas.data)[number] & { unidades: { nome: string } | null };
  const lics = (licencas.data ?? []) as Linha[];
  const nomeUnidade = (l: Linha) => l.unidades?.nome ?? "—";
  const rotulo = (l: Linha) => `${nomeUnidade(l)} · ${orgaoLabel(l.orgao)}`;

  const comCnae = new Set((cnaes.data ?? []).map((c) => c.unidade_id));

  const grupos: GrupoProblema[] = [];

  const semVencimento = lics.filter((l) => l.status === "vigente" && !l.data_vencimento);
  grupos.push({
    chave: "vigente_sem_vencimento",
    titulo: "Licenças “vigente” sem data de vencimento",
    descricao:
      "Constam como vigentes mas não têm prazo registado, por isso nunca entram no semáforo nem nos alertas de renovação.",
    recomendacao:
      "Nos certificados da REDESIM estas atividades costumam vir sem prazo por serem dispensadas de licenciamento. Confirme e marque como dispensada, ou registe a data de validade.",
    severidade: "erro",
    acao: "marcar_dispensada",
    total: semVencimento.length,
    itens: semVencimento.map((l) => ({
      id: l.id,
      rotulo: rotulo(l),
      detalhe: l.descricao ?? "Sem descrição",
    })),
  });

  const vencidaPorPrazo = lics.filter(
    (l) =>
      ["vigente", "a_vencer"].includes(l.status) && l.data_vencimento && l.data_vencimento < hoje,
  );
  grupos.push({
    chave: "prazo_passado",
    titulo: "Licenças com prazo já passado mas ainda em dia",
    descricao: "A data de validade já passou e a situação continua a indicar que está em ordem.",
    recomendacao: "Execute a correção automática para alinhar a situação com a data de validade.",
    severidade: "erro",
    acao: "sincronizar_vencidas",
    total: vencidaPorPrazo.length,
    itens: vencidaPorPrazo.map((l) => ({
      id: l.id,
      rotulo: rotulo(l),
      detalhe: `${statusLabel(l.status)} · vence ${l.data_vencimento}`,
    })),
  });

  const vencidaComPrazoFuturo = lics.filter(
    (l) => l.status === "vencida" && l.data_vencimento && l.data_vencimento >= hoje,
  );
  grupos.push({
    chave: "vencida_prazo_futuro",
    titulo: "Licenças marcadas como vencidas com prazo em aberto",
    descricao: "A data de validade ainda não chegou, mas a situação diz vencida.",
    recomendacao: "Confirme no certificado e corrija a situação, ou a data, na ficha da licença.",
    severidade: "aviso",
    acao: "nenhuma",
    total: vencidaComPrazoFuturo.length,
    itens: vencidaComPrazoFuturo.map((l) => ({
      id: l.id,
      rotulo: rotulo(l),
      detalhe: `vence ${l.data_vencimento}`,
    })),
  });

  const semCnae = (unidades.data ?? []).filter((u) => !comCnae.has(u.id));
  grupos.push({
    chave: "unidade_sem_cnae",
    titulo: "Unidades sem CNAEs cadastrados",
    descricao:
      "A unidade tem ficha aberta mas nenhuma atividade económica registada, então a matriz por CNAE fica vazia.",
    recomendacao:
      "Releia o certificado arquivado da unidade: a leitura por IA traz os CNAEs e liga-os às licenças de cada órgão.",
    severidade: "erro",
    acao: "reler_certificados",
    total: semCnae.length,
    itens: semCnae.map((u) => {
      const total = lics.filter((l) => l.unidade_id === u.id).length;
      const orgaos = new Set(lics.filter((l) => l.unidade_id === u.id).map((l) => l.orgao)).size;
      return {
        id: u.id,
        rotulo: u.nome,
        detalhe: `${total} licença(s) em ${orgaos} órgão(s) · CNPJ ${u.cnpj ?? "—"}`,
      };
    }),
  });

  const semPrazoNemSituacao = lics.filter(
    (l) => l.status === "a_vencer" && !l.data_vencimento,
  );
  grupos.push({
    chave: "a_vencer_sem_prazo",
    titulo: "Licenças “a vencer” sem data",
    descricao: "Sinalizadas para renovação, mas sem prazo que permita calcular a antecedência.",
    recomendacao: "Registe a data de validade que consta no certificado.",
    severidade: "aviso",
    acao: "nenhuma",
    total: semPrazoNemSituacao.length,
    itens: semPrazoNemSituacao.map((l) => ({
      id: l.id,
      rotulo: rotulo(l),
      detalhe: l.descricao ?? "Sem descrição",
    })),
  });

  const docsSoltos = (documentos.data ?? []).filter((d) => !d.unidade_id);
  grupos.push({
    chave: "documento_sem_unidade",
    titulo: "Documentos arquivados sem unidade",
    descricao: "Ficheiros no arquivo que não estão ligados a nenhuma unidade.",
    recomendacao: "Abra o documento e associe-o à unidade correspondente, ou remova-o do arquivo.",
    severidade: "informacao",
    acao: "nenhuma",
    total: docsSoltos.length,
    itens: docsSoltos.map((d) => ({
      id: d.id,
      rotulo: d.nome,
      detalhe: `Categoria: ${d.categoria}`,
    })),
  });

  const comProblema = grupos.filter((g) => g.total > 0);
  return {
    executado_em: new Date().toISOString(),
    total_problemas: comProblema.length,
    total_itens: comProblema.reduce((s, g) => s + g.total, 0),
    grupos,
  };
}
