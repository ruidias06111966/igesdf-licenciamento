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
import { STATUS_LABEL, type StatusLicenca } from "@/lib/domain";
import { mensagemErro } from "@/lib/errors";
import { upsertCnae } from "@/lib/licencas.functions";
import { invalidarDados } from "@/lib/queries";
import type { CnaeUnidade } from "@/lib/rows";

type Valores = {
  id?: string;
  unidade_id: string;
  codigo: string;
  descricao: string;
  cnpj_ses_legado: string;
  status: StatusLicenca;
  data_vencimento: string;
  observacoes: string;
};

function paraFormulario(unidadeId: string, c?: CnaeUnidade): Valores {
  return {
    id: c?.id,
    unidade_id: unidadeId,
    codigo: c?.codigo ?? "",
    descricao: c?.descricao ?? "",
    cnpj_ses_legado: c?.cnpj_ses_legado ?? "",
    status: (c?.status ?? "pendente_declaracao") as StatusLicenca,
    data_vencimento: c?.data_vencimento ?? "",
    observacoes: c?.observacoes ?? "",
  };
}

export function CnaeForm({
  trigger,
  unidadeId,
  cnae,
}: {
  trigger: ReactNode;
  unidadeId: string;
  cnae?: CnaeUnidade;
}) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: (valores: Valores) => upsertCnae({ data: valores }),
    onSuccess: () => {
      toast.success(cnae ? "CNAE atualizado" : "CNAE cadastrado");
      invalidarDados(qc);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<Valores>
      titulo={cnae ? "Editar CNAE" : "Novo CNAE"}
      descricao="Atividade econômica declarada à Vigilância Sanitária."
      trigger={trigger}
      valorInicial={() => paraFormulario(unidadeId, cnae)}
      podeSalvar={(v) => v.codigo.trim().length >= 3 && v.descricao.trim().length >= 2}
      onSubmit={(v) => salvar.mutateAsync(v)}
    >
      {(v, definir) => (
        <>
          <FieldRow>
            <Field label="Código CNAE" obrigatorio htmlFor="cnae-codigo">
              <Input
                id="cnae-codigo"
                required
                placeholder="8610-1/02"
                value={v.codigo}
                onChange={(e) => definir("codigo", e.target.value)}
              />
            </Field>
            <Field
              label="CNPJ SES-DF (legado)"
              htmlFor="cnae-cnpj"
              dica="Preencher só quando a atividade veio do cadastro antigo da SES."
            >
              <Input
                id="cnae-cnpj"
                value={v.cnpj_ses_legado}
                onChange={(e) => definir("cnpj_ses_legado", e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Descrição da atividade" obrigatorio htmlFor="cnae-descricao">
            <Textarea
              id="cnae-descricao"
              required
              rows={2}
              value={v.descricao}
              onChange={(e) => definir("descricao", e.target.value)}
            />
          </Field>

          <FieldRow>
            <Field label="Situação" htmlFor="cnae-status">
              <Select
                value={v.status}
                onValueChange={(valor) => definir("status", valor as StatusLicenca)}
              >
                <SelectTrigger id="cnae-status">
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
            <Field label="Vencimento" htmlFor="cnae-vencimento">
              <Input
                id="cnae-vencimento"
                type="date"
                value={v.data_vencimento}
                onChange={(e) => definir("data_vencimento", e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Observações" htmlFor="cnae-obs">
            <Textarea
              id="cnae-obs"
              rows={2}
              value={v.observacoes}
              onChange={(e) => definir("observacoes", e.target.value)}
            />
          </Field>
        </>
      )}
    </FormSheet>
  );
}
