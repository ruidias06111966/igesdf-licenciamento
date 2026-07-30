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
import { mensagemErro } from "@/lib/errors";
import { upsertRT } from "@/lib/licencas.functions";
import { invalidarDados } from "@/lib/queries";
import type { ResponsavelTecnico } from "@/lib/rows";

const CONSELHOS = ["CRM", "COREN", "CRF", "CRO", "CRBM", "CREA", "CRA", "OUTRO"];

type Valores = {
  id?: string;
  unidade_id: string;
  nome: string;
  cpf: string;
  conselho: string;
  numero_registro: string;
  cargo: string;
  email: string;
  telefone: string;
  observacoes: string;
};

function paraFormulario(unidadeId: string, r?: ResponsavelTecnico): Valores {
  return {
    id: r?.id,
    unidade_id: unidadeId,
    nome: r?.nome ?? "",
    cpf: r?.cpf ?? "",
    conselho: r?.conselho ?? "CRM",
    numero_registro: r?.numero_registro ?? "",
    cargo: r?.cargo ?? "",
    email: r?.email ?? "",
    telefone: r?.telefone ?? "",
    observacoes: r?.observacoes ?? "",
  };
}

export function RTForm({
  trigger,
  unidadeId,
  responsavel,
}: {
  trigger: ReactNode;
  unidadeId: string;
  responsavel?: ResponsavelTecnico;
}) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: (valores: Valores) => upsertRT({ data: valores }),
    onSuccess: () => {
      toast.success(responsavel ? "Responsável atualizado" : "Responsável cadastrado");
      invalidarDados(qc);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<Valores>
      titulo={responsavel ? "Editar responsável técnico" : "Novo responsável técnico"}
      descricao="O Termo de Responsabilidade Técnica é exigido pela Vigilância Sanitária."
      trigger={trigger}
      valorInicial={() => paraFormulario(unidadeId, responsavel)}
      podeSalvar={(v) => v.nome.trim().length >= 2}
      onSubmit={(v) => salvar.mutateAsync(v)}
    >
      {(v, definir) => (
        <>
          <Field label="Nome completo" obrigatorio htmlFor="rt-nome">
            <Input
              id="rt-nome"
              required
              value={v.nome}
              onChange={(e) => definir("nome", e.target.value)}
            />
          </Field>

          <FieldRow>
            <Field label="Conselho de classe" htmlFor="rt-conselho">
              <Select value={v.conselho} onValueChange={(valor) => definir("conselho", valor)}>
                <SelectTrigger id="rt-conselho">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSELHOS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nº de registro" htmlFor="rt-registro">
              <Input
                id="rt-registro"
                value={v.numero_registro}
                onChange={(e) => definir("numero_registro", e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Cargo" htmlFor="rt-cargo">
              <Input
                id="rt-cargo"
                value={v.cargo}
                onChange={(e) => definir("cargo", e.target.value)}
              />
            </Field>
            <Field label="CPF" htmlFor="rt-cpf">
              <Input
                id="rt-cpf"
                inputMode="numeric"
                value={v.cpf}
                onChange={(e) => definir("cpf", e.target.value)}
                placeholder="000.000.000-00"
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="E-mail" htmlFor="rt-email">
              <Input
                id="rt-email"
                type="email"
                value={v.email}
                onChange={(e) => definir("email", e.target.value)}
              />
            </Field>
            <Field label="Telefone" htmlFor="rt-telefone">
              <Input
                id="rt-telefone"
                inputMode="tel"
                value={v.telefone}
                onChange={(e) => definir("telefone", e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Observações" htmlFor="rt-obs">
            <Textarea
              id="rt-obs"
              rows={2}
              value={v.observacoes}
              onChange={(e) => definir("observacoes", e.target.value)}
              placeholder="Vínculo, data de assinatura do termo…"
            />
          </Field>
        </>
      )}
    </FormSheet>
  );
}
