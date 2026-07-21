import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Building2, LayoutDashboard, FileCheck2, CalendarClock, LogOut, ShieldCheck, Landmark, FileBarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const nav = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/unidades", label: "Unidades", icon: Building2 },
  { to: "/licencas", label: "Licenças", icon: FileCheck2 },
  { to: "/orgaos", label: "Órgãos", icon: Landmark },
  { to: "/calendario", label: "Vencimentos", icon: CalendarClock },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
];

function AuthedLayout() {
  const router = useRouter();
  async function logout() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }
  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr] bg-background">
      <aside className="bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <ShieldCheck className="size-6 text-sidebar-primary" />
          <div>
            <div className="font-semibold text-sm leading-tight">IGESDF</div>
            <div className="text-xs opacity-70 leading-tight">Compliance</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/60 transition">
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60" onClick={logout}>
            <LogOut className="size-4 mr-2" /> Terminar sessão
          </Button>
        </div>
      </aside>
      <main className="overflow-auto"><Outlet /></main>
    </div>
  );
}
