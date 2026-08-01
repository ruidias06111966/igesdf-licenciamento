import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Field, FieldRow, FormSheet } from "@/components/form-sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ORGAOS,
  SITUACOES_PROCESSO,
  TIPOS_PROCESSO,
  orgaoDescricao,
  type Orgao,
} from "@/lib/domain";
import { mensagemErro } from "@/lib/errors";
import { upsertProcesso } from "@/lib/processos.functions";
import { invalidarDados } from "@/lib/queries";
import type { ProcessoSei } from "@/lib/rows";

type Valores = {
  id?: string;
  unidade_id: string;
  numero: string;
  assunto: string;
  tipo: string;
  orgao: Orgao | "";
  situacao: string;
  data_abertura: string;
  data_conclusao: string;
  link: string;
  responsavel: string;
  observacoes: string;
};

/** Cadastro do processo SEI de uma unidade (uma unidade pode ter vários). */
export function ProcessoForm({
  trigger,
  processo,
  unidadeId,
  unidades,
}: {
  trigger: ReactNode;
  processo?: ProcessoSei;
  unidadeId?: string;
  unidades?: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const salvar = useMutation({
    mutationFn: (v: Valores) =>
      upsertProcesso({ data: { ...v, orgao: v.orgao === "" ? null : v.orgao } }),
    onSuccess: () => {
      toast.success(processo ? "Processo atualizado" : "Processo cadastrado");
      invalidarDados(qc);
    },
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  return (
    <FormSheet<Valores>
      titulo={processo ? "Editar processo SEI" : "Novo processo SEI"}
      descricao="Registre o número real do processo no SEI e o órgão a que se dirige."
      trigger={trigger}
      valorInicial={() => ({
        id: processo?.id,
        unidade_id: processo?.unidade_id ?? unidadeId ?? "",
        numero: processo?.numero ?? "",
        assunto: processo?.assunto ?? "",
        tipo: processo?.tipo ?? "licenciamento",
        orgao: (processo?.orgao ?? "") as Orgao | "",
        situacao: processo?.situacao ?? "em_andamento",
        data_abertura: processo?.data_abertura ?? "",
        data_conclusao: processo?.data_conclusao ?? "",
        link: processo?.link ?? "",
        responsavel: processo?.responsavel ?? "",
        observacoes: processo?.observacoes ?? "",
      })}
      podeSalvar={(v) => Boolean(v.unidade_id) && v.numero.trim().length >= 3}
      onSubmit={(v) => salvar.mutateAsync(v)}
    >
      {(v, definir) => (
        <>
          {unidades && (
            <Field label="Unidade" obrigatorio htmlFor="proc-unidade">
              <Select value={v.unidade_id} onValueChange={(valor) => definir("unidade_id", valor)}>
                <SelectTrigger id="proc-unidade">
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
            <Field
              label="Número do processo SEI"
              obrigatorio
              htmlFor="proc-numero"
              dica="Formato do SEI-GDF, ex.: 00060-00012345/2026-11"
            >
              <Input
                id="proc-numero"
                required
                value={v.numero}
                onChange={(e) => definir("numero", e.target.value)}
              />
            </Field>
            <Field label="Tipo" htmlFor="proc-tipo">
              <Select value={v.tipo} onValueChange={(valor) => definir("tipo", valor)}>
                <SelectTrigger id="proc-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_PROCESSO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <Field label="Assunto" htmlFor="proc-assunto">
            <Input
              id="proc-assunto"
              value={v.assunto}
              onChange={(e) => definir("assunto", e.target.value)}
              placeholder="Ex.: Licenciamento sanitário — CNAE 8610-1/01"
            />
          </Field>

          <FieldRow>
            <Field
              label="Órgão"
              htmlFor="proc-orgao"
              dica={v.orgao ? orgaoDescricao(v.orgao) : "Define o checklist de documentos."}
            >
              <Select
                value={v.orgao || "nenhum"}
                onValueChange={(valor) =>
                  definir("orgao", valor === "nenhum" ? "" : (valor as Orgao))
                }
              >
                <SelectTrigger id="proc-orgao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem órgão definido</SelectItem>
                  {ORGAOS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Situação" htmlFor="proc-situacao">
              <Select value={v.situacao} onValueChange={(valor) => definir("situacao", valor)}>
                <SelectTrigger id="proc-situacao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUACOES_PROCESSO.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Data de abertura" htmlFor="proc-abertura">
              <Input
                id="proc-abertura"
                type="date"
                value={v.data_abertura}
                onChange={(e) => definir("data_abertura", e.target.value)}
              />
            </Field>
            <Field label="Data de conclusão" htmlFor="proc-conclusao">
              <Input
                id="proc-conclusao"
                type="date"
                value={v.data_conclusao}
                onChange={(e) => definir("data_conclusao", e.target.value)}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Responsável" htmlFor="proc-responsavel">
              <Input
                id="proc-responsavel"
                value={v.responsavel}
                onChange={(e) => definir("responsavel", e.target.value)}
              />
            </Field>
            <Field label="Link do SEI" htmlFor="proc-link">
              <Input
                id="proc-link"
                value={v.link}
                onChange={(e) => definir("link", e.target.value)}
                placeholder="https://sei.df.gov.br/…"
              />
            </Field>
          </FieldRow>

          <Field label="Observações" htmlFor="proc-obs">
            <Textarea
              id="proc-obs"
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
