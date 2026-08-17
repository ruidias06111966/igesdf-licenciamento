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
import {
  CATEGORIAS_CNPJ,
  TITULARES_CNES,
  type CategoriaCnpj,
  type TitularCnes,
} from "@/lib/cnpj-unidades";

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
  nome_fantasia: string;
  bairro: string;
  cep: string;
  inicio_atividade: string;
  cnae_principal: string;
  cnae_principal_desc: string;
  cnes: string;
  cnpj_ses: string;
  cnpj_cnes: string;
  titular_cnes: TitularCnes;
  codigo_mv: string;
  codigo_mv_nota: string;
  categoria_cnpj: CategoriaCnpj;
  tipo_estabelecimento: "Matriz" | "Filial";
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
    nome_fantasia: u?.nome_fantasia ?? "",
    bairro: u?.bairro ?? "",
    cep: u?.cep ?? "",
    inicio_atividade: u?.inicio_atividade ?? "",
    cnae_principal: u?.cnae_principal ?? "",
    cnae_principal_desc: u?.cnae_principal_desc ?? "",
    cnes: u?.cnes ?? "",
    cnpj_ses: u?.cnpj_ses ?? "",
    cnpj_cnes: u?.cnpj_cnes ?? "",
    titular_cnes: (u?.titular_cnes ?? "sem") as TitularCnes,
    codigo_mv: u?.codigo_mv ?? "",
    codigo_mv_nota: u?.codigo_mv_nota ?? "",
    categoria_cnpj: (u?.categoria_cnpj ?? "apoio") as CategoriaCnpj,
    tipo_estabelecimento: (u?.tipo_estabelecimento ?? "Filial") as "Matriz" | "Filial",
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

          <p className="border-t pt-4 text-sm font-medium text-muted-foreground">
            Cadastro CNPJ / CNES
          </p>

          <FieldRow>
            <Field label="Nome fantasia" htmlFor="uni-fantasia">
              <Input
                id="uni-fantasia"
                value={v.nome_fantasia}
                onChange={(e) => definir("nome_fantasia", e.target.value)}
              />
            </Field>
            <Field label="Código SOULMV" htmlFor="uni-mv">
              <Input
                id="uni-mv"
                value={v.codigo_mv}
                onChange={(e) => definir("codigo_mv", e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Categoria" htmlFor="uni-categoria">
              <Select
                value={v.categoria_cnpj}
                onValueChange={(valor) => definir("categoria_cnpj", valor as CategoriaCnpj)}
              >
                <SelectTrigger id="uni-categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_CNPJ.map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Estabelecimento" htmlFor="uni-estab">
              <Select
                value={v.tipo_estabelecimento}
                onValueChange={(valor) =>
                  definir("tipo_estabelecimento", valor as "Matriz" | "Filial")
                }
              >
                <SelectTrigger id="uni-estab">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Matriz">Matriz</SelectItem>
                  <SelectItem value="Filial">Filial</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="CNES" htmlFor="uni-cnes">
              <Input
                id="uni-cnes"
                value={v.cnes}
                onChange={(e) => definir("cnes", e.target.value)}
              />
            </Field>
            <Field label="Titularidade do CNES" htmlFor="uni-titular">
              <Select
                value={v.titular_cnes}
                onValueChange={(valor) => definir("titular_cnes", valor as TitularCnes)}
              >
                <SelectTrigger id="uni-titular">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TITULARES_CNES.map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field
              label="CNPJ SES-DF (sufixo)"
              htmlFor="uni-ses"
              dica="Só o final, ex.: 0295-24 (raiz 00.394.700)."
            >
              <Input
                id="uni-ses"
                value={v.cnpj_ses}
                onChange={(e) => definir("cnpj_ses", e.target.value)}
                placeholder="0295-24"
              />
            </Field>
            <Field label="CNPJ titular do CNES" htmlFor="uni-cnpj-cnes">
              <Input
                id="uni-cnpj-cnes"
                value={v.cnpj_cnes}
                onChange={(e) => definir("cnpj_cnes", e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="CNAE principal" htmlFor="uni-cnae">
              <Input
                id="uni-cnae"
                value={v.cnae_principal}
                onChange={(e) => definir("cnae_principal", e.target.value)}
                placeholder="8610-1/01"
              />
            </Field>
            <Field label="Início da atividade" htmlFor="uni-inicio">
              <Input
                id="uni-inicio"
                type="date"
                value={v.inicio_atividade}
                onChange={(e) => definir("inicio_atividade", e.target.value)}
              />
            </Field>
          </FieldRow>

          <Field label="Descrição do CNAE principal" htmlFor="uni-cnae-desc">
            <Input
              id="uni-cnae-desc"
              value={v.cnae_principal_desc}
              onChange={(e) => definir("cnae_principal_desc", e.target.value)}
            />
          </Field>

          <FieldRow>
            <Field label="Bairro" htmlFor="uni-bairro">
              <Input
                id="uni-bairro"
                value={v.bairro}
                onChange={(e) => definir("bairro", e.target.value)}
              />
            </Field>
            <Field label="CEP" htmlFor="uni-cep">
              <Input id="uni-cep" value={v.cep} onChange={(e) => definir("cep", e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="Nota do código MV" htmlFor="uni-mv-nota">
            <Input
              id="uni-mv-nota"
              value={v.codigo_mv_nota}
              onChange={(e) => definir("codigo_mv_nota", e.target.value)}
            />
          </Field>
        </>
      )}
    </FormSheet>
  );
}
