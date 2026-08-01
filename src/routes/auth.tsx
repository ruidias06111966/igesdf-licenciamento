import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, TriangleAlert } from "lucide-react";
import { acessoConfigurado, entrar } from "@/lib/acesso.functions";
import { mensagemErro } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — IGESDF - Licenciamento" },
      {
        name: "description",
        content:
          "Acesso ao painel de compliance regulatório do IGESDF: gestão de licenças, alvarás e prazos de renovação da rede hospitalar do Distrito Federal.",
      },
      { property: "og:title", content: "Entrar — IGESDF - Licenciamento" },
      {
        property: "og:description",
        content: "Acesso ao painel de compliance regulatório do IGESDF.",
      },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/auth" }],
  }),
});

function AuthPage() {
  const navegar = useNavigate();
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ["acesso-configurado"],
    queryFn: () => acessoConfigurado(),
    staleTime: 60_000,
  });

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      const res = await entrar({ data: { senha } });
      if (!res.ok) {
        setErro(
          res.motivo === "limite"
            ? (res.mensagem ?? "Muitas tentativas. Aguarde alguns minutos.")
            : "Senha incorreta.",
        );
        setSenha("");
        return;
      }
      // O guarda de rota lê o cookie no servidor, por isso é preciso invalidar
      // o que o router já tem em cache antes de navegar.
      await router.invalidate();
      await navegar({ to: "/dashboard" });
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-8 text-sidebar-primary" aria-hidden="true" />
          <div>
            <div className="text-xl font-semibold">IGESDF - Licenciamento</div>
            <div className="text-sm opacity-70">Gestão integrada de licenciamentos</div>
          </div>
        </div>
        <div className="max-w-md space-y-3">
          <h1 className="text-3xl leading-tight font-semibold">
            Do CNPJ ao alvará, tudo controlado em um só lugar.
          </h1>
          <p className="text-sm opacity-80">
            Hospitais, UPAs e unidades administrativas — Vigilância Sanitária, CBMDF, IBRAM, CNES e
            Administração Regional. Datas, documentos e responsáveis técnicos em uma matriz de
            compliance.
          </p>
        </div>
        <div className="text-xs opacity-60">
          Instituto de Gestão Estratégica de Saúde do Distrito Federal
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 lg:hidden">
              <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
              <span className="font-semibold">IGESDF - Licenciamento</span>
            </div>
            <CardTitle>Senha de acesso</CardTitle>
            <CardDescription>
              Senha única da equipe. Não há cadastro nem contas individuais — informe uma vez e o
              acesso fica guardado neste navegador por 30 dias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config && !config.configurado ? (
              <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">Senha de acesso não configurada</p>
                  <p className="mt-1 text-xs">
                    Defina a variável de ambiente <code className="font-mono">ACESSO_SENHA</code>{" "}
                    nas configurações do projeto e recarregue esta página.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={submeter} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="senha">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={verSenha ? "text" : "password"}
                      autoComplete="current-password"
                      autoFocus
                      required
                      className="pr-10"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      aria-invalid={Boolean(erro)}
                      aria-describedby={erro ? "senha-erro" : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
                      aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setVerSenha((v) => !v)}
                    >
                      {verSenha ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  {erro && (
                    <p id="senha-erro" role="alert" className="text-xs text-destructive">
                      {erro}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={ocupado || senha.length === 0}>
                  {ocupado ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
