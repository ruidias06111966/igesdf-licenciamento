import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — IGESDF Compliance" },
      { name: "description", content: "Acesso ao painel de compliance regulatório do IGESDF: gestão de licenças, alvarás e prazos de renovação da rede hospitalar do Distrito Federal." },
      { property: "og:title", content: "Entrar — IGESDF Compliance" },
      { property: "og:description", content: "Acesso ao painel de compliance regulatório do IGESDF." },
      { property: "og:url", content: "https://igesdf-licenciamento.qidominios.tech/auth" },
    ],
    links: [{ rel: "canonical", href: "https://igesdf-licenciamento.qidominios.tech/auth" }],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Autenticado");
    navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada. Verifique o email se necessário.");
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(res.error.message ?? "Falha no login com Google");
    else if (!res.redirected) navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-8 text-sidebar-primary" />
          <div>
            <div className="text-xl font-semibold">IGESDF Compliance</div>
            <div className="text-sm opacity-70">Gestão integrada de licenciamentos</div>
          </div>
        </div>
        <div className="space-y-3 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Do CNPJ ao alvará, tudo controlado num só lugar.</h1>
          <p className="text-sm opacity-80">Hospitais, UPAs e unidades administrativas — Vigilância Sanitária, CBMDF, IBRAM, CNES, Administração Regional. Datas, documentos e responsáveis técnicos numa matriz de compliance.</p>
        </div>
        <div className="text-xs opacity-60">Instituto de Gestão Estratégica de Saúde do Distrito Federal</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Aceda ao painel de compliance regulatório.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full mb-4" onClick={google}>Continuar com Google</Button>
            <div className="text-center text-xs text-muted-foreground mb-4">ou com email</div>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={signIn} className="space-y-3 mt-4">
                  <div><Label htmlFor="e1">Email</Label><Input id="e1" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
                  <div><Label htmlFor="p1">Senha</Label><Input id="p1" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
                  <Button disabled={loading} type="submit" className="w-full">{loading ? "A entrar…" : "Entrar"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3 mt-4">
                  <div><Label htmlFor="e2">Email</Label><Input id="e2" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
                  <div><Label htmlFor="p2">Senha</Label><Input id="p2" type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
                  <Button disabled={loading} type="submit" className="w-full">{loading ? "A criar…" : "Criar conta"}</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
