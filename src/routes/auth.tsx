import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, MailCheck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

type Modo = "entrar" | "criar" | "recuperar";

function AuthPage() {
  const navegar = useNavigate();
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      if (modo === "criar") {
        if (senha.length < 8) {
          setErro("A senha tem de ter pelo menos 8 caracteres.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: { nome: nome.trim() },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
        setAviso(
          "Conta criada. Enviámos um e-mail de confirmação para " +
            email.trim() +
            ". Confirme o endereço e depois entre — o acesso ainda terá de ser autorizado pelo utilizador master.",
        );
        setSenha("");
        setModo("entrar");
        return;
      }

      if (modo === "recuperar") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setAviso("Se este e-mail estiver registado, receberá um link para definir nova senha.");
        setModo("entrar");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        setErro(
          error.message.toLowerCase().includes("not confirmed")
            ? "Confirme primeiro o e-mail que lhe enviámos."
            : "E-mail ou senha incorretos.",
        );
        setSenha("");
        return;
      }
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
            <CardTitle>
              {modo === "criar"
                ? "Criar conta"
                : modo === "recuperar"
                  ? "Recuperar senha"
                  : "Entrar"}
            </CardTitle>
            <CardDescription>
              {modo === "criar"
                ? "Cadastre o seu e-mail e escolha uma senha. Receberá um e-mail de confirmação; depois o utilizador master autoriza o seu perfil (consulta, edição ou master)."
                : modo === "recuperar"
                  ? "Indique o e-mail da sua conta para receber o link de nova senha."
                  : "Entre com o e-mail e a senha da sua conta."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submeter} className="space-y-4">
              {aviso && (
                <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                  <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>{aviso}</p>
                </div>
              )}

              {modo === "criar" && (
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    autoComplete="name"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {modo !== "recuperar" && (
                <div className="space-y-1.5">
                  <Label htmlFor="senha">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={verSenha ? "text" : "password"}
                      autoComplete={modo === "criar" ? "new-password" : "current-password"}
                      required
                      minLength={modo === "criar" ? 8 : undefined}
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
                </div>
              )}

              {erro && (
                <p id="senha-erro" role="alert" className="text-xs text-destructive">
                  {erro}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={ocupado}>
                {ocupado
                  ? "A processar…"
                  : modo === "criar"
                    ? "Criar conta"
                    : modo === "recuperar"
                      ? "Enviar link"
                      : "Entrar"}
              </Button>

              <div className="flex flex-wrap justify-between gap-2 text-xs">
                {modo === "entrar" ? (
                  <>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setModo("criar");
                        setErro(null);
                      }}
                    >
                      Criar conta
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => {
                        setModo("recuperar");
                        setErro(null);
                      }}
                    >
                      Esqueci a senha
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      setModo("entrar");
                      setErro(null);
                    }}
                  >
                    Já tenho conta — entrar
                  </button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
