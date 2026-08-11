import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { Field, FieldRow, FormSheet } from "@/components/form-sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORGAOS, STATUS_LABEL, orgaoDescricao, type Orgao, type StatusLicenca } from "@/lib/domain";
import { mensagemErro } from "@/lib/errors";
import { upsertLicenca } from "@/lib/licencas.functions";
import { invalidarDados } from "@/lib/queries";
import type { Licenca, LicencaDashboard, Unidade } from "@/lib/rows";

export type ValoresLicenca = {
  id?: string;
  unidade_id: string;
  orgao: Orgao;
  status: StatusLicenca;
  descricao: string;
  numero: string;
  processo_sei: string;
  data_emissao: string;
  data_vencimento: string;
  data_protocolo: string;
  observacoes: string;
};
type Valores = ValoresLicenca;

/** Aceita tanto a linha da tabela como a linha da view do painel. */
type LicencaEditavel = Licenca | LicencaDashboard;

function paraFormulario(unidadeId: string, l?: LicencaEditavel): Valores {
  return {
    id: l?.id ?? undefined,
    unidade_id: l?.unidade_id ?? unidadeId,
    orgao: (l?.orgao ?? "VISA") as Orgao,
    status: (l?.status ?? "nao_iniciado") as StatusLicenca,
    descricao: l?.descricao ?? "",
    numero: l?.numero ?? "",
    processo_sei: l?.processo_sei ?? "",
    data_emissao: l?.data_emissao ?? "",
    data_vencimento: l?.data_vencimento ?? "",
    data_protocolo: l?.data_protocolo ?? "",
    observacoes: l?.observacoes ?? "",
  };
}

/**
 * Formulário único de licença, usado pela listagem global e pela ficha da
 * unidade. Quando `unidades` é fornecido, mostra o seletor de unidade; na ficha
 * a unidade já está fixada pelo contexto.
 */
export function LicencaForm({
  trigger,
  licenca,
  unidadeId,
  unidades,
  onSaved,
}: {
  trigger: ReactNode;
  licenca?: LicencaEditavel;
  unidadeId?: string;
  unidades?: Unidade[];
  /**
   * Chamada depois de gravar. A listagem usa-a para avisar quando o registo
   * gravado deixa de aparecer por causa dos filtros ativos — antes parecia que
   * a licença tinha desaparecido.
   */
  onSaved?: (valores: Valores) => void;
}) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: (valores: Valores) => upsertLicenca({ data: valores }),
    onSuccess: (_res, valores) => {
      toast.success(licenca ? "Licença atualizada" : "Licença cadastrada");
      invalidarDados(qc);
      onSaved?.(valores);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<Valores>
      titulo={licenca ? "Editar licença" : "Nova licença"}
      descricao="Um registro por atividade licenciada (CNAE) em cada órgão."
      trigger={trigger}
      valorInicial={() => paraFormulario(unidadeId ?? "", licenca)}
      podeSalvar={(v) => Boolean(v.unidade_id)}
      onSubmit={(v) => salvar.mutateAsync(v)}
    >
      {(v, definir) => (
        <>
          {unidades && (
            <Field label="Unidade" obrigatorio htmlFor="lic-unidade">
              <Select value={v.unidade_id} onValueChange={(valor) => definir("unidade_id", valor)}>
                <SelectTrigger id="lic-unidade">
                  <SelectValue placeholder="Escolher unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <FieldRow>
            <Field label="Órgão" htmlFor="lic-orgao" dica={orgaoDescricao(v.orgao)}>
              <Select value={v.orgao} onValueChange={(valor) => definir("orgao", valor as Orgao)}>
                <SelectTrigger id="lic-orgao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORGAOS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Situação" htmlFor="lic-status">
              <Select
                value={v.status}
                onValueChange={(valor) => definir("status", valor as StatusLicenca)}
              >
                <SelectTrigger id="lic-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <Field
            label="CNAE / atividade licenciada"
            htmlFor="lic-descricao"
            dica="Mantenha o formato “CNAE 0000-0/00 — Atividade” para que o código seja reconhecido nos filtros."
          >
            <Input
              id="lic-descricao"
              placeholder="Ex.: CNAE 8610-1/02 — Pronto-socorro"
              value={v.descricao}
              onChange={(e) => definir("descricao", e.target.value)}
            />
          </Field>

          <FieldRow>
            <Field label="Número da licença" htmlFor="lic-numero">
              <Input
                id="lic-numero"
                value={v.numero}
                onChange={(e) => definir("numero", e.target.value)}
              />
            </Field>
            <Field label="Processo SEI" htmlFor="lic-sei">
              <Input
                id="lic-sei"
                value={v.processo_sei}
                onChange={(e) => definir("processo_sei", e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Data de emissão" htmlFor="lic-emissao">
              <Input
                id="lic-emissao"
                type="date"
                value={v.data_emissao}
                onChange={(e) => definir("data_emissao", e.target.value)}
              />
            </Field>
            <Field
              label="Data de vencimento"
              htmlFor="lic-vencimento"
              dica="Base do semáforo e dos alertas de renovação."
            >
              <Input
                id="lic-vencimento"
                type="date"
                value={v.data_vencimento}
                onChange={(e) => definir("data_vencimento", e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Data de protocolo" htmlFor="lic-protocolo">
            <Input
              id="lic-protocolo"
              type="date"
              value={v.data_protocolo}
              onChange={(e) => definir("data_protocolo", e.target.value)}
            />
          </Field>

          <Field label="Observações" htmlFor="lic-obs">
            <Textarea
              id="lic-obs"
              rows={3}
              value={v.observacoes}
              onChange={(e) => definir("observacoes", e.target.value)}
            />
          </Field>
        </>
      )}
    </FormSheet>
  );
}
