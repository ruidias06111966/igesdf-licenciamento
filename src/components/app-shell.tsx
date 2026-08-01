import { Link, Outlet } from "@tanstack/react-router";
import {
  BookText,
  Building2,
  CalendarClock,
  FileBarChart2,
  FileCheck2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ItemNav = { to: string; label: string; icon: ComponentType<{ className?: string }> };

const NAV: ItemNav[] = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/unidades", label: "Unidades", icon: Building2 },
  { to: "/licencas", label: "Licenças", icon: FileCheck2 },
  { to: "/calendario", label: "Vencimentos", icon: CalendarClock },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart2 },
  { to: "/orgaos", label: "Órgãos", icon: Landmark },
  { to: "/normativas", label: "Normativas", icon: BookText },
];

function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <ShieldCheck className="size-6 shrink-0 text-sidebar-primary" aria-hidden="true" />
      <div className="min-w-0 leading-tight">
        <div className="text-sm font-semibold">IGESDF</div>
        {!compacta && <div className="text-xs opacity-70">Licenciamento</div>}
      </div>
    </div>
  );
}

function ListaNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex-1 space-y-1 p-3">
      {NAV.map(({ to, label, icon: Icone }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/60"
          activeProps={{
            className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
            "aria-current": "page",
          }}
        >
          <Icone className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Rodape({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60"
        onClick={onLogout}
      >
        <LogOut className="mr-2 size-4" aria-hidden="true" /> Sair
      </Button>
    </div>
  );
}

/**
 * Estrutura da área autenticada.
 *
 * A versão anterior usava `grid-cols-[260px_1fr]` fixo, sem nenhuma variante
 * responsiva: em telemóvel e tablet a barra lateral roubava a maior parte da
 * largura e o conteúdo ficava inutilizável. Agora a lateral é fixa apenas a
 * partir de `lg` e, abaixo disso, vira uma gaveta aberta pela barra superior.
 */
export function AppShell({ onLogout }: { onLogout: () => void }) {
  const [gavetaAberta, setGavetaAberta] = useState(false);

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden flex-col bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-sidebar-border p-5">
          <Marca />
        </div>
        <ListaNav />
        <Rodape onLogout={onLogout} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header
          className={cn(
            "app-header sticky top-0 z-30 flex items-center gap-3 border-b",
            "bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden",
          )}
        >
          <Sheet open={gavetaAberta} onOpenChange={setGavetaAberta}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Abrir menu de navegação"
                className="text-sidebar-foreground hover:bg-sidebar-accent/60"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-72 flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground"
            >
              <div className="border-b border-sidebar-border p-5 pr-12">
                <SheetTitle asChild>
                  <div>
                    <Marca />
                  </div>
                </SheetTitle>
              </div>
              <ListaNav onNavigate={() => setGavetaAberta(false)} />
              <Rodape onLogout={onLogout} />
            </SheetContent>
          </Sheet>
          <Marca compacta />
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
