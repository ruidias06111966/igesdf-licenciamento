import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, FileSearch, Loader2, MinusCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { aplicarCertificado } from "@/lib/certificado.functions";
import {
  CAMPO_LABEL,
  linhasAplicaveis,
  resumoAnalise,
  type AnaliseCertificado,
  type LinhaAnalise,
} from "@/lib/certificado";
import { formatDate, orgaoLabel, statusLabel } from "@/lib/domain";
import { mensagemErro } from "@/lib/errors";
import { invalidarDados } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Apresenta um valor de campo já no formato que o utilizador reconhece. */
function valorLegivel(campo: string, valor: string | null): string {
  if (valor === null || valor === "") return "—";
  if (campo === "status") return statusLabel(valor);
  if (campo === "data_emissao" || campo === "data_vencimento") return formatDate(valor);
  return valor;
}

function tituloLinha(l: LinhaAnalise): string {
  if (l.tipo === "cnae_novo") return `CNAE ${l.codigo} — ${l.descricao}`;
  return `${orgaoLabel(l.orgao)} · ${l.descricao}`;
}

/**
 * Quadro de diferenças entre o certificado lido e a base.
 *
 * A regra do módulo está aqui à vista: só as linhas marcadas são gravadas, e
 * as licenças que existem na base mas não aparecem no certificado ficam
 * apenas sinalizadas — nunca são alteradas nem removidas, porque um
 * certificado parcial não é prova de que a licença deixou de existir.
 */
export function CertificadoAnalise({
  analise,
  onFechar,
}: {
  analise: AnaliseCertificado;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const aplicaveis = useMemo(() => linhasAplicaveis(analise.linhas), [analise.linhas]);
  const [marcadas, setMarcadas] = useState<Set<string>>(
    () => new Set(aplicaveis.map((l) => l.chave)),
  );
  const [ocupado, setOcupado] = useState(false);
  const resumo = resumoAnalise(analise.linhas);

  const iguais = analise.linhas.filter((l) => l.tipo === "licenca_igual");
  const ausentes = analise.linhas.filter((l) => l.tipo === "licenca_ausente");

  function alternar(chave: string) {
    setMarcadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }

  async function aplicar() {
    const escolhidas = aplicaveis.filter((l) => marcadas.has(l.chave));
    if (escolhidas.length === 0) return;
    setOcupado(true);
    try {
      const payload = escolhidas.map((l) => {
        if (l.tipo === "cnae_novo") {
          return { tipo: "cnae_novo" as const, codigo: l.codigo, descricao: l.descricao };
        }
        if (l.tipo === "licenca_nova") {
          return {
            tipo: "licenca_nova" as const,
            orgao: l.orgao,
            descricao: l.descricao,
            valores: l.valores,
            observacoes: l.observacoes,
          };
        }
        return {
          tipo: "licenca_alterada" as const,
          licenca_id: l.licenca_id,
          campos: l.campos.map((c) => ({ campo: c.campo, depois: c.depois })),
        };
      });
      const r = await aplicarCertificado({
        data: {
          unidade_id: analise.unidade_id,
          documento_id: analise.documento_id,
          linhas: payload,
        },
      });
      toast.success(
        `Aplicado: ${r.licencasAtualizadas} licença(s) atualizada(s), ${r.licencasCriadas} criada(s), ${r.cnaesCriados} CNAE(s) novo(s).`,
      );
      invalidarDados(qc);
      onFechar();
    } catch (erro) {
      toast.error(mensagemErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !ocupado && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="size-4" aria-hidden="true" /> Diferenças encontradas no
            certificado
          </DialogTitle>
          <DialogDescription>
            Nada é gravado sem a sua confirmação. Desmarque o que não quiser aplicar; os campos que
            o certificado não traz ficam exatamente como estão hoje.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{resumo.alteradas} alteração(ões)</Badge>
            <Badge variant="outline">{resumo.novas} licença(s) nova(s)</Badge>
            <Badge variant="outline">{resumo.cnaes} CNAE(s) novo(s)</Badge>
            <Badge variant="secondary">{resumo.iguais} sem alteração</Badge>
            <Badge variant="secondary">{resumo.ausentes} não consta(m) no certificado</Badge>
          </div>

          {(analise.cabecalho.cnpj || analise.cabecalho.nome) && (
            <p className="text-xs text-muted-foreground">
              Documento lido: {analise.cabecalho.nome ?? "—"}
              {analise.cabecalho.cnpj && <span> · CNPJ {analise.cabecalho.cnpj}</span>}
              {analise.cabecalho.emitido_em && (
                <span> · emitido em {formatDate(analise.cabecalho.emitido_em)}</span>
              )}
            </p>
          )}

          {analise.avisos.map((a) => (
            <p
              key={a}
              className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {a}
            </p>
          ))}

          {aplicaveis.length === 0 ? (
            <p className="rounded-md border bg-muted/40 p-3 text-sm">
              O certificado confere com o que está na base. Não há nada a atualizar.
            </p>
          ) : (
            <ul className="space-y-2">
              {aplicaveis.map((l) => {
                const marcada = marcadas.has(l.chave);
                return (
                  <li
                    key={l.chave}
                    className={cn(
                      "rounded-md border p-3 transition-colors",
                      marcada ? "border-primary/40 bg-primary/5" : "opacity-70",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={l.chave}
                        checked={marcada}
                        onCheckedChange={() => alternar(l.chave)}
                        aria-label={`Aplicar: ${tituloLinha(l)}`}
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label htmlFor={l.chave} className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={l.tipo === "licenca_alterada" ? "default" : "outline"}
                            className="gap-1"
                          >
                            {l.tipo === "licenca_alterada" ? (
                              <Check className="size-3" aria-hidden="true" />
                            ) : (
                              <Plus className="size-3" aria-hidden="true" />
                            )}
                            {l.tipo === "licenca_alterada"
                              ? "Alterar"
                              : l.tipo === "licenca_nova"
                                ? "Nova licença"
                                : "Novo CNAE"}
                          </Badge>
                          <span className="font-medium">{tituloLinha(l)}</span>
                        </label>

                        {l.tipo === "licenca_alterada" && (
                          <ul className="space-y-0.5 text-xs">
                            {l.campos.map((c) => (
                              <li key={c.campo} className="flex flex-wrap items-center gap-1.5">
                                <span className="text-muted-foreground">
                                  {CAMPO_LABEL[c.campo]}:
                                </span>
                                <span className="line-through opacity-60">
                                  {valorLegivel(c.campo, c.antes)}
                                </span>
                                <span aria-hidden="true">→</span>
                                <span className="font-medium">
                                  {valorLegivel(c.campo, c.depois)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {l.tipo === "licenca_nova" && (
                          <p className="text-xs text-muted-foreground">
                            {statusLabel(l.valores.status)}
                            {l.valores.numero && <span> · nº {l.valores.numero}</span>}
                            {l.valores.data_vencimento && (
                              <span> · vence em {formatDate(l.valores.data_vencimento)}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {ausentes.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                <MinusCircle className="size-3.5" aria-hidden="true" /> Existem na base e não
                aparecem no certificado — nada foi alterado
              </p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {ausentes.map((l) => (
                  <li key={l.chave}>
                    {orgaoLabel(l.orgao)} · {l.descricao}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {iguais.length > 0 && (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-xs font-medium">
                {iguais.length} registo(s) já conferem com o certificado
              </summary>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {iguais.map((l) => (
                  <li key={l.chave}>
                    {orgaoLabel(l.orgao)} · {l.descricao}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={ocupado}>
            Fechar sem aplicar
          </Button>
          <Button onClick={aplicar} disabled={ocupado || marcadas.size === 0}>
            {ocupado && <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />}
            Aplicar {marcadas.size} alteração(ões)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
