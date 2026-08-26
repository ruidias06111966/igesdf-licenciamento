import { createServerFn } from "@tanstack/react-start";
import { calcularSemaforo } from "@/lib/domain";

export const getResumoPublico = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: unidades, error: ue } = await supabaseAdmin
    .from("unidades")
    .select("id")
    .eq("ativa", true);
  if (ue) throw ue;

  const pagina = 1000;
  const todas: {
    id: string | null;
    unidade_id: string | null;
    status: string | null;
    data_vencimento: string | null;
    semaforo: string | null;
  }[] = [];
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabaseAdmin
      .from("v_licencas_dashboard")
      .select("id, unidade_id, status, data_vencimento, semaforo")
      .order("data_vencimento", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    if (error) throw error;
    const linhas = data ?? [];
    todas.push(...linhas);
    if (linhas.length < pagina) break;
  }

  const idsVencidos = new Set<string>();
  let vencidas = 0;
  let critico = 0;
  let atencao = 0;
  let emdia = 0;
  let aguardandoProtocolo = 0;

  const STATUS_PENDENTES = [
    "nao_iniciado",
    "em_analise",
    "aguardando_orgao",
    "pendente_declaracao",
    "em_estudo",
  ];

  for (const l of todas) {
    const s = l.semaforo ?? calcularSemaforo(l).toString();
    if (s === "vencida") {
      vencidas += 1;
      if (l.unidade_id) idsVencidos.add(l.unidade_id);
    } else if (s === "a_vencer_critico") {
      critico += 1;
    } else if (s === "a_vencer_alerta") {
      atencao += 1;
    } else if (s === "vigente") {
      emdia += 1;
    }
    if (STATUS_PENDENTES.includes(l.status ?? "")) {
      aguardandoProtocolo += 1;
    }
  }

  const { data: certificado, error: ce } = await supabaseAdmin
    .from("documentos")
    .select("created_at")
    .ilike("categoria", "certificado")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ce) throw ce;

  const ultimaLeitura = certificado?.created_at
    ? new Date(certificado.created_at).toLocaleDateString("pt-BR")
    : "—";

  return {
    unidades: unidades?.length ?? 0,
    vencidas,
    unidadesComVencida: idsVencidos.size,
    vencendo90: critico + atencao,
    aguardandoProtocolo,
    ultimaLeitura,
    faixas: {
      vencido: vencidas,
      critico,
      atencao,
      emdia: emdia + (todas.length - vencidas - critico - atencao - emdia),
    },
  };
});
