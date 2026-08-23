import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { definirPerfilUtilizador, listarUtilizadores } from "@/lib/acesso.functions";
import { mensagemErro } from "@/lib/errors";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/sub-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/utilizadores")({
  component: Pagina,
  head: () => ({
    meta: [
      { title: "Utilizadores · IGESDF Licenciamento" },
      {
        name: "description",
        content:
          "Autorização de contas do sistema de licenciamento do IGESDF: perfis de consulta, edição e master, com suspensão de acesso.",
      },
      { property: "og:title", content: "Utilizadores · IGESDF Licenciamento" },
      {
        property: "og:description",
        content: "Quem entra no sistema e com que perfil — autorizado pelo master.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PERFIS = [
  { valor: "leitura", label: "Consulta e impressão" },
  { valor: "edicao", label: "Edição (inserir, alterar, excluir)" },
  { valor: "master", label: "Master (tudo, incluindo IA e despachos)" },
] as const;

function dataCurta(valor: string | null) {
  return valor ? new Date(valor).toLocaleDateString("pt-BR") : "—";
}

function Pagina() {
  const queryClient = useQueryClient();
  const { data: utilizadores, isLoading } = useQuery({
    queryKey: ["utilizadores"],
    queryFn: () => listarUtilizadores(),
  });

  const guardar = useMutation({
    mutationFn: (v: { userId: string; perfil: "master" | "edicao" | "leitura" | null; suspenso?: boolean }) =>
      definirPerfilUtilizador({ data: v }),
    onSuccess: () => {
      toast.success("Acesso atualizado.");
      queryClient.invalidateQueries({ queryKey: ["utilizadores"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const pendentes = (utilizadores ?? []).filter((u) => !u.perfil && !u.suspenso);
  const ativos = (utilizadores ?? []).filter((u) => u.perfil && !u.suspenso);
  const suspensos = (utilizadores ?? []).filter((u) => u.suspenso);

  function Linha({ u }: { u: NonNullable<typeof utilizadores>[number] }) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{u.nome || u.email}</div>
          <div className="truncate text-xs text-muted-foreground">
            {u.email} · cadastrado em {dataCurta(u.created_at)} · último acesso{" "}
            {dataCurta(u.ultimo_acesso)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={u.perfil ?? ""}
            onValueChange={(perfil) =>
              guardar.mutate({
                userId: u.user_id,
                perfil: perfil as "master" | "edicao" | "leitura",
                suspenso: false,
              })
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Sem perfil (pendente)" />
            </SelectTrigger>
            <SelectContent>
              {PERFIS.map((p) => (
                <SelectItem key={p.valor} value={p.valor}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {u.suspenso ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => guardar.mutate({ userId: u.user_id, perfil: u.perfil as never, suspenso: false })}
            >
              <UserCheck className="mr-2 size-4" aria-hidden="true" /> Reativar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                guardar.mutate({ userId: u.user_id, perfil: u.perfil as never, suspenso: true })
              }
            >
              <UserX className="mr-2 size-4" aria-hidden="true" /> Suspender
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        titulo="Utilizadores"
        descricao="Contas cadastradas e o que cada uma pode fazer. Só o master autoriza."
        migalhas={[
          { label: "Início", to: "/dashboard" },
          { label: "Configurações", to: "/configuracoes" },
          { label: "Utilizadores" },
        ]}
      />
      <SubNav grupo="configuracoes" />

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" aria-hidden="true" /> Aguardam autorização
            <Badge variant="secondary">{pendentes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta pendente.</p>
          ) : (
            pendentes.map((u) => <Linha key={u.user_id} u={u} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Com acesso ({ativos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ativos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda ninguém autorizado.</p>
          ) : (
            ativos.map((u) => <Linha key={u.user_id} u={u} />)
          )}
        </CardContent>
      </Card>

      {suspensos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suspensos ({suspensos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suspensos.map((u) => (
              <Linha key={u.user_id} u={u} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
