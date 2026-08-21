import { Link } from "@tanstack/react-router";
import { useEhMaster } from "@/lib/perfil";

/**
 * Navegação entre vistas da mesma matéria.
 *
 * A barra lateral estava a crescer com entradas que são leituras diferentes
 * dos mesmos dados (CNPJ é a ficha da unidade; a Matriz é a lista de licenças
 * em grelha; os Vencimentos são o painel filtrado por prazo; o Consolidado é
 * um relatório agregado). Em vez de treze entradas de topo, cada matéria tem
 * agora uma entrada e as suas vistas ficam aqui, junto ao conteúdo.
 *
 * As rotas antigas continuam válidas — ligações e favoritos guardados não
 * deixam de funcionar.
 */
type Vista = { to: string; label: string; master?: boolean };

const GRUPOS: Record<string, Vista[]> = {
  unidades: [
    { to: "/unidades", label: "Unidades" },
    { to: "/cnpj", label: "Cadastro CNPJ" },
  ],
  licencas: [
    { to: "/licencas", label: "Lista" },
    { to: "/matriz", label: "Matriz" },
  ],
  painel: [
    { to: "/dashboard", label: "Painel" },
    { to: "/calendario", label: "Vencimentos" },
  ],
  relatorios: [
    { to: "/relatorios", label: "Conformidade" },
    { to: "/consolidado", label: "Consolidado da rede", master: true },
  ],
};

export function SubNav({ grupo }: { grupo: keyof typeof GRUPOS }) {
  const ehMaster = useEhMaster();
  const vistas = (GRUPOS[grupo] ?? []).filter((v) => !v.master || ehMaster);
  if (vistas.length < 2) return null;

  return (
    <nav aria-label="Vistas desta secção" className="no-print -mt-2 mb-4 flex flex-wrap gap-1">
      {vistas.map((v) => (
        <Link
          key={v.to}
          to={v.to}
          className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          activeProps={{
            className: "bg-primary/10 border-primary/40 text-foreground font-medium",
            "aria-current": "page",
          }}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
