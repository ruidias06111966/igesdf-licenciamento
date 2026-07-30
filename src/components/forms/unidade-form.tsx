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
import { SITUACOES_EDIFICACAO, TIPO_UNIDADE_LABEL, type TipoUnidade } from "@/lib/domain";
import { mensagemErro } from "@/lib/errors";
import { upsertUnidade } from "@/lib/licencas.functions";
import { invalidarDados } from "@/lib/queries";
import type { Unidade } from "@/lib/rows";

type Valores = {
  id?: string;
  nome: string;
  tipo: TipoUnidade;
  numero_iges: number | null;
  cnpj: string;
  cf_df: string;
  processo_sei: string;
  endereco: string;
  regiao_administrativa: string;
  situacao_edificacao: string;
  observacoes: string;
};

function paraFormulario(u?: Unidade): Valores {
  return {
    id: u?.id,
    nome: u?.nome ?? "",
    tipo: (u?.tipo ?? "hospital") as TipoUnidade,
    numero_iges: u?.numero_iges ?? null,
    cnpj: u?.cnpj ?? "",
    cf_df: u?.cf_df ?? "",
    processo_sei: u?.processo_sei ?? "",
    endereco: u?.endereco ?? "",
    regiao_administrativa: u?.regiao_administrativa ?? "",
    situacao_edificacao: u?.situacao_edificacao ?? "operando",
    observacoes: u?.observacoes ?? "",
  };
}

/**
 * Cadastro de unidade. Vive aqui, e não no arquivo de rota, porque a ficha da
 * unidade também o usa — importar de um módulo de rota quebra o fast refresh e
 * cria uma dependência circular entre rotas.
 */
export function UnidadeForm({ trigger, unidade }: { trigger: ReactNode; unidade?: Unidade }) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: (valores: Valores) => upsertUnidade({ data: valores }),
    onSuccess: () => {
      toast.success(unidade ? "Unidade atualizada" : "Unidade cadastrada");
      invalidarDados(qc);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<Valores>
      titulo={unidade ? "Editar unidade" : "Nova unidade"}
      descricao="Hospitais, UPAs e unidades administrativas da rede IGESDF."
      trigger={trigger}
      valorInicial={() => paraFormulario(unidade)}
      podeSalvar={(v) => v.nome.trim().length >= 2}
      onSubmit={(v) => salvar.mutateAsync(v)}
    >
      {(v, definir) => (
        <>
          <Field label="Nome da unidade" obrigatorio htmlFor="uni-nome">
            <Input
              id="uni-nome"
              required
              value={v.nome}
              onChange={(e) => definir("nome", e.target.value)}
              placeholder="Ex.: UPA Gama"
            />
          </Field>

          <FieldRow>
            <Field label="Tipo" htmlFor="uni-tipo">
              <Select
                value={v.tipo}
                onValueChange={(valor) => definir("tipo", valor as TipoUnidade)}
              >
                <SelectTrigger id="uni-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_UNIDADE_LABEL).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nº IGES" htmlFor="uni-numero">
              <Input
                id="uni-numero"
                type="number"
                inputMode="numeric"
                value={v.numero_iges ?? ""}
                onChange={(e) =>
                  definir(
                    "numero_iges",
                    e.target.value ? Number.parseInt(e.target.value, 10) : null,
                  )
                }
              />
            </Field>
          </FieldRow>

          <Field label="CNPJ" htmlFor="uni-cnpj" dica="Do estabelecimento, não da matriz.">
            <Input
              id="uni-cnpj"
              inputMode="numeric"
              value={v.cnpj}
              onChange={(e) => definir("cnpj", e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </Field>

          <FieldRow>
            <Field label="CF/DF" htmlFor="uni-cf">
              <Input
                id="uni-cf"
                value={v.cf_df}
                onChange={(e) => definir("cf_df", e.target.value)}
              />
            </Field>
            <Field label="Processo SEI" htmlFor="uni-sei">
              <Input
                id="uni-sei"
                value={v.processo_sei}
                onChange={(e) => definir("processo_sei", e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field
              label="Situação da edificação"
              htmlFor="uni-situacao"
              dica="Define o fluxo: obra e reforma começam pelo projeto e Habite-se."
            >
              <Select
                value={v.situacao_edificacao}
                onValueChange={(valor) => definir("situacao_edificacao", valor)}
              >
                <SelectTrigger id="uni-situacao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUACOES_EDIFICACAO.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Região administrativa" htmlFor="uni-ra">
              <Input
                id="uni-ra"
                value={v.regiao_administrativa}
                onChange={(e) => definir("regiao_administrativa", e.target.value)}
                placeholder="Ex.: Gama"
              />
            </Field>
          </FieldRow>

          <Field label="Endereço" htmlFor="uni-endereco">
            <Textarea
              id="uni-endereco"
              rows={2}
              value={v.endereco}
              onChange={(e) => definir("endereco", e.target.value)}
            />
          </Field>

          <Field label="Observações" htmlFor="uni-obs">
            <Textarea
              id="uni-obs"
              rows={3}
              value={v.observacoes}
              onChange={(e) => definir("observacoes", e.target.value)}
              placeholder="Viabilidade, área utilizada, certificado REDESIM…"
            />
          </Field>
        </>
      )}
    </FormSheet>
  );
}
