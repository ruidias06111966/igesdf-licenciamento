import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Building2, ImageUp, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/sub-nav";
import { ErrorState, EmptyState } from "@/components/states";
import { FormSheet, Field, FieldRow } from "@/components/form-sheet";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { mensagemErro } from "@/lib/errors";
import { MARCA, titulo, url } from "@/lib/marca";
import { chaves, empresasQuery } from "@/lib/queries";
import { useEhMaster } from "@/lib/perfil";
import { desativarEmpresa, enviarLogoEmpresa, upsertEmpresa } from "@/lib/empresas.functions";
import { formatDate } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/empresas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(empresasQuery),
  component: Pagina,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
  head: () => ({
    meta: [
      { title: titulo("Empresas") },
      {
        name: "description",
        content:
          "Empresas clientes servidas por esta instalação: sigla, nome por extenso, raiz do CNPJ e logótipo usado nos documentos.",
      },
      { property: "og:title", content: titulo("Empresas") },
      { property: "og:url", content: url("/empresas") },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: url("/empresas") }],
  }),
});

type Formulario = { id?: string; sigla: string; nome: string; cnpj_raiz: string };

function Pagina() {
  const ehMaster = useEhMaster();
  const qc = useQueryClient();
  const { data: empresas } = useSuspenseQuery(empresasQuery);

  const salvar = useMutation({
    mutationFn: (v: Formulario) => upsertEmpresa({ data: v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chaves.empresas });
      toast.success("Empresa gravada.");
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  // A desativação não passa por `useMutation` de propósito: o `ConfirmDelete`
  // já trata do estado, do sucesso e do erro, e duplicar isso daria dois toasts
  // por cada clique.
  async function desativar(id: string) {
    await desativarEmpresa({ data: { id } });
    void qc.invalidateQueries({ queryKey: chaves.empresas });
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Empresas"
        descricao={`Clientes servidos por esta instalação do ${MARCA.produto}. O logótipo de cada uma sai nos documentos das suas unidades.`}
        migalhas={[
          { label: "Início", to: "/dashboard" },
          { label: "Configurações", to: "/configuracoes" },
          { label: "Empresas" },
        ]}
        acoes={
          ehMaster ? (
            <FormularioEmpresa
              titulo="Nova empresa"
              valorInicial={() => ({ sigla: "", nome: "", cnpj_raiz: "" })}
              onSubmit={(v) => salvar.mutateAsync(v)}
              trigger={<Button>Nova empresa</Button>}
            />
          ) : null
        }
      />
      <SubNav grupo="configuracoes" />

      {!ehMaster && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Só o utilizador master cria empresas ou troca logótipos. Aqui vê quais existem.
        </p>
      )}

      {empresas.length === 0 ? (
        <EmptyState
          icone={<Building2 className="size-6" aria-hidden="true" />}
          titulo="Nenhuma empresa registada"
          descricao="Crie a primeira para as unidades poderem ser atribuídas."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {empresas.map((e) => (
            <Card key={e.id} className={e.ativa ? undefined : "opacity-60"}>
              <CardContent className="flex items-start gap-4 p-4">
                <Logotipo empresa={e} podeTrocar={ehMaster} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{e.sigla}</span>
                    {!e.ativa && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        desativada
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{e.nome}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.unidadesAtivas === 1
                      ? "1 unidade ativa"
                      : `${e.unidadesAtivas} unidades ativas`}
                    {" · "}
                    {e.cnpj_raiz ? `CNPJ raiz ${e.cnpj_raiz}` : "sem raiz de CNPJ"} · desde{" "}
                    {formatDate(e.created_at)}
                  </p>

                  {ehMaster && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <FormularioEmpresa
                        titulo={`Editar ${e.sigla}`}
                        valorInicial={() => ({
                          id: e.id,
                          sigla: e.sigla,
                          nome: e.nome,
                          cnpj_raiz: e.cnpj_raiz ?? "",
                        })}
                        onSubmit={(v) => salvar.mutateAsync(v)}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Pencil className="mr-1.5 size-3.5" aria-hidden="true" /> Editar
                          </Button>
                        }
                      />
                      {e.ativa && (
                        <ConfirmDelete
                          titulo={`Desativar ${e.sigla}?`}
                          descricao={
                            e.unidadesAtivas > 0
                              ? `A empresa deixa de aparecer para escolher, mas as suas ${e.unidadesAtivas} unidades ativas e todo o histórico de licenciamento ficam como estão — nada é apagado.`
                              : "A empresa deixa de aparecer para escolher. Nada é apagado."
                          }
                          rotuloConfirmar="Desativar"
                          mensagemSucesso="Empresa desativada"
                          onConfirm={() => desativar(e.id)}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Power className="mr-1.5 size-3.5" aria-hidden="true" /> Desativar
                            </Button>
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type Empresa = { id: string; sigla: string; logo_url: string | null };

/** Logótipo com troca por clique — só para o master. */
function Logotipo({ empresa, podeTrocar }: { empresa: Empresa; podeTrocar: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function escolhido(ficheiro: File | undefined) {
    if (!ficheiro) return;
    setEnviando(true);
    try {
      const form = new FormData();
      form.set("arquivo", ficheiro);
      form.set("empresaId", empresa.id);
      await enviarLogoEmpresa({ data: form });
      void qc.invalidateQueries({ queryKey: chaves.empresas });
      toast.success("Logótipo atualizado.");
    } catch (erro) {
      toast.error(mensagemErro(erro));
    } finally {
      setEnviando(false);
      // Permite voltar a escolher o mesmo ficheiro depois de uma falha.
      if (input.current) input.current.value = "";
    }
  }

  const moldura =
    "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white";

  const imagem = empresa.logo_url ? (
    <img
      src={empresa.logo_url}
      alt={`Logótipo ${empresa.sigla}`}
      className="size-full object-contain p-1.5"
    />
  ) : (
    <Building2 className="size-7 text-muted-foreground" aria-hidden="true" />
  );

  if (!podeTrocar) return <div className={moldura}>{imagem}</div>;

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        onChange={(ev) => void escolhido(ev.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={enviando}
        aria-label={`Trocar o logótipo de ${empresa.sigla}`}
        className={`${moldura} group relative cursor-pointer transition-colors hover:border-primary`}
      >
        {imagem}
        <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex">
          <ImageUp className="size-5" aria-hidden="true" />
        </span>
        {enviando && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/80 text-[11px]">
            a enviar…
          </span>
        )}
      </button>
    </>
  );
}

function FormularioEmpresa({
  titulo: rotulo,
  valorInicial,
  onSubmit,
  trigger,
}: {
  titulo: string;
  valorInicial: () => Formulario;
  onSubmit: (v: Formulario) => Promise<unknown>;
  trigger: React.ReactNode;
}) {
  return (
    <FormSheet<Formulario>
      titulo={rotulo}
      descricao="A sigla aparece na interface; o nome por extenso é o que sai nos documentos oficiais."
      trigger={trigger}
      valorInicial={valorInicial}
      onSubmit={onSubmit}
      podeSalvar={(v) => v.sigla.trim().length >= 2 && v.nome.trim().length >= 3}
    >
      {(v, definir) => (
        <>
          <FieldRow>
            <Field label="Sigla" obrigatorio htmlFor="sigla" dica="Ex.: IGESDF">
              <Input
                id="sigla"
                value={v.sigla}
                maxLength={20}
                onChange={(e) => definir("sigla", e.target.value)}
              />
            </Field>
            <Field
              label="Raiz do CNPJ"
              htmlFor="cnpj_raiz"
              dica="8 dígitos, partilhados pelas unidades"
            >
              <Input
                id="cnpj_raiz"
                inputMode="numeric"
                value={v.cnpj_raiz}
                onChange={(e) => definir("cnpj_raiz", e.target.value)}
              />
            </Field>
          </FieldRow>
          <Field label="Nome por extenso" obrigatorio htmlFor="nome">
            <Input
              id="nome"
              value={v.nome}
              maxLength={200}
              onChange={(e) => definir("nome", e.target.value)}
            />
          </Field>
        </>
      )}
    </FormSheet>
  );
}
