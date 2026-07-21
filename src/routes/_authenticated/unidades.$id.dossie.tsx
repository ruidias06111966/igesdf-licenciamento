import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDossieUnidade } from "@/lib/licencas.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORGAOS, STATUS_LABEL, CHECKLIST_STATUS_LABEL, semaforoColor, formatDate, parseCnae } from "@/lib/domain";
import { ArrowLeft, Printer, FileText, ListChecks, UserCog } from "lucide-react";
import { useEffect } from "react";

function dossieOpts(id: string) {
  return queryOptions({ queryKey: ["dossie", id], queryFn: () => getDossieUnidade({ data: { id } }) });
}

export const Route = createFileRoute("/_authenticated/unidades/$id/dossie")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(dossieOpts(params.id)),
  component: Dossie,
  head: () => ({ meta: [{ title: "Dossiê da unidade — IGESDF Compliance" }] }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Unidade não encontrada.</div>,
});

function semaforoOf(l: any) {
  if (l.status === "dispensada" || l.status === "indeferida") return l.status;
  if (!l.data_vencimento) return l.status;
  const dias = Math.round((new Date(l.data_vencimento).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "vencida";
  if (dias <= 60) return "a_vencer_critico";
  if (dias <= 90) return "a_vencer_alerta";
  return "vigente";
}

function Dossie() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(dossieOpts(id));
  const { unidade, licencas, responsaveis, documentos, cnaes, checklist } = data as any;

  // Ativa layout retrato ao imprimir
  useEffect(() => {
    document.body.classList.add("print-portrait");
    return () => { document.body.classList.remove("print-portrait"); };
  }, []);

  const kpi = {
    total: licencas.length,
    vigentes: licencas.filter((l: any) => semaforoOf(l) === "vigente").length,
    vencidas: licencas.filter((l: any) => semaforoOf(l) === "vencida").length,
    criticas: licencas.filter((l: any) => semaforoOf(l) === "a_vencer_critico").length,
    alerta: licencas.filter((l: any) => semaforoOf(l) === "a_vencer_alerta").length,
    pendentes: licencas.filter((l: any) => ["nao_iniciado","em_analise","aguardando_orgao","pendente_declaracao","em_estudo"].includes(l.status)).length,
  };

  // Agrupar por órgão
  const porOrgao: Record<string, any[]> = {};
  for (const l of licencas) (porOrgao[l.orgao] ??= []).push(l);

  return (
    <div className="p-8 space-y-6 print-area max-w-5xl mx-auto">
      <div className="flex items-center gap-2 no-print">
        <Link to="/unidades/$id" params={{ id }}><Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" /> Voltar à unidade</Button></Link>
        <div className="ml-auto"><Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-1" /> Imprimir PDF</Button></div>
      </div>

      <header className="border-b pb-4">
        <div className="text-xs text-muted-foreground">Relatório de conformidade — IGESDF · emitido em {new Date().toLocaleDateString("pt-PT")}</div>
        <h1 className="text-2xl font-semibold mt-1">Dossiê · {unidade.nome}</h1>
        <div className="text-sm text-muted-foreground mt-1 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
          <div>Nº IGES: <b>{unidade.numero_iges ?? "—"}</b></div>
          <div>CNPJ: <b>{unidade.cnpj ?? "—"}</b></div>
          <div>CF/DF: <b>{unidade.cf_df ?? "—"}</b></div>
          <div>SEI: <b>{unidade.processo_sei ?? "—"}</b></div>
          {unidade.endereco && <div className="col-span-full">Endereço: {unidade.endereco}</div>}
        </div>
      </header>

      <section className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { k: "Total", v: kpi.total, cls: "bg-muted" },
          { k: "Vigentes", v: kpi.vigentes, cls: "bg-success/15 text-success" },
          { k: "Pendentes", v: kpi.pendentes, cls: "bg-info/15 text-info" },
          { k: "A vencer", v: kpi.alerta, cls: "bg-warning/20" },
          { k: "Crítico", v: kpi.criticas, cls: "bg-destructive/15 text-destructive" },
          { k: "Vencidas", v: kpi.vencidas, cls: "bg-destructive/25 text-destructive" },
        ].map(x => (
          <div key={x.k} className={`p-3 rounded-md ${x.cls}`}>
            <div className="text-xs">{x.k}</div>
            <div className="text-2xl font-semibold">{x.v}</div>
          </div>
        ))}
      </section>

      {Object.entries(porOrgao).sort(([a],[b])=>a.localeCompare(b)).map(([orgao, items]) => {
        const org = ORGAOS.find(o => o.value === orgao);
        const itensCk = (checklist as any[]).filter(c => c.licencas?.orgao === orgao);
        return (
          <Card key={orgao}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{org?.label ?? orgao} <span className="text-xs text-muted-foreground font-normal">— {org?.descricao ?? ""}</span></CardTitle></CardHeader>
            <CardContent className="space-y-3 p-3">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-1.5">CNAE</th>
                    <th className="p-1.5">Atividade</th>
                    <th className="p-1.5">Situação</th>
                    <th className="p-1.5">Nº / SEI</th>
                    <th className="p-1.5">Emissão</th>
                    <th className="p-1.5">Vencimento</th>
                    <th className="p-1.5">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(l => {
                    const cn = parseCnae(l.descricao);
                    const s = semaforoColor(semaforoOf(l));
                    return (
                      <tr key={l.id} className="border-b last:border-0 print-row">
                        <td className="p-1.5 font-mono">{cn.codigo ?? "—"}</td>
                        <td className="p-1.5">{cn.label ?? "—"}</td>
                        <td className="p-1.5">{STATUS_LABEL[l.status as keyof typeof STATUS_LABEL] ?? l.status}</td>
                        <td className="p-1.5">{[l.numero, l.processo_sei].filter(Boolean).join(" / ") || "—"}</td>
                        <td className="p-1.5">{formatDate(l.data_emissao)}</td>
                        <td className="p-1.5">{formatDate(l.data_vencimento)}</td>
                        <td className="p-1.5"><Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {itensCk.length > 0 && (
                <div className="border-t pt-2">
                  <div className="text-xs font-medium flex items-center gap-1 mb-1"><ListChecks className="size-3" /> Checklist ({itensCk.filter(i=>i.status==="concluido").length}/{itensCk.length} concluídos)</div>
                  <ul className="text-xs space-y-0.5">
                    {itensCk.map((it: any) => (
                      <li key={it.id} className="flex justify-between gap-2 border-b last:border-0 py-0.5">
                        <span>{it.status === "concluido" ? "✅" : it.status === "em_curso" ? "🟡" : it.status === "nao_aplicavel" ? "➖" : "⬜"} {it.titulo}</span>
                        <span className="text-muted-foreground text-right">{it.responsavel ?? "—"}{it.data_conclusao ? ` · ${formatDate(it.data_conclusao)}` : ""} · {CHECKLIST_STATUS_LABEL[it.status]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {items.some((l: any) => l.observacoes) && (
                <div className="border-t pt-2 text-xs italic text-muted-foreground space-y-0.5">
                  {items.filter((l: any) => l.observacoes).map((l: any) => <div key={l.id}>Obs. {parseCnae(l.descricao).codigo ?? ""}: {l.observacoes}</div>)}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {cnaes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">CNAEs cadastrados ({cnaes.length})</CardTitle></CardHeader>
          <CardContent className="p-3">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="p-1.5">Código</th><th className="p-1.5">Descrição</th><th className="p-1.5">Estado</th><th className="p-1.5">Vencimento</th></tr>
              </thead>
              <tbody>
                {cnaes.map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0"><td className="p-1.5 font-mono">{c.codigo}</td><td className="p-1.5">{c.descricao}</td><td className="p-1.5">{STATUS_LABEL[c.status as keyof typeof STATUS_LABEL] ?? c.status}</td><td className="p-1.5">{formatDate(c.data_vencimento)}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {responsaveis.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><UserCog className="size-4" /> Responsáveis Técnicos ({responsaveis.length})</CardTitle></CardHeader>
          <CardContent className="p-3">
            <ul className="text-xs space-y-1">
              {responsaveis.map((r: any) => (
                <li key={r.id} className="border-b last:border-0 pb-1"><b>{r.nome}</b> — {r.conselho} {r.numero_registro} · {r.cargo ?? "—"} {r.email && <>· {r.email}</>}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {documentos.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="size-4" /> Documentos vigentes ({documentos.length})</CardTitle></CardHeader>
          <CardContent className="p-3">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="p-1.5">Nome</th><th className="p-1.5">Categoria</th><th className="p-1.5">Versão</th><th className="p-1.5">Validade</th><th className="p-1.5">Carregado</th></tr>
              </thead>
              <tbody>
                {documentos.map((d: any) => (
                  <tr key={d.id} className="border-b last:border-0"><td className="p-1.5">{d.nome}</td><td className="p-1.5">{d.categoria}</td><td className="p-1.5">v{d.versao}</td><td className="p-1.5">{formatDate(d.data_validade)}</td><td className="p-1.5">{new Date(d.created_at).toLocaleDateString("pt-PT")}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <footer className="text-xs text-muted-foreground border-t pt-2 print-only">
        Relatório gerado por IGESDF Compliance · {new Date().toLocaleString("pt-PT")}
      </footer>
    </div>
  );
}