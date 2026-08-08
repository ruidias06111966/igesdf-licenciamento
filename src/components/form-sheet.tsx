import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePodeEditar } from "@/lib/perfil";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Atualiza um campo do formulário preservando o resto. */
export type DefinirCampo<T> = <K extends keyof T>(campo: K, valor: T[K]) => void;

type Props<T> = {
  titulo: string;
  descricao?: string;
  trigger: ReactNode;
  /**
   * Chamada **cada vez que a gaveta abre**, e não uma única vez na montagem.
   *
   * Os formulários usavam `useState(initial)`, que congela o valor no primeiro
   * render: depois de salvar e a lista recarregar, reabrir a edição mostrava os
   * dados antigos, e uma edição abandonada reaparecia na abertura seguinte.
   */
  valorInicial: () => T;
  onSubmit: (valores: T) => Promise<unknown>;
  /** Bloqueia o botão de salvar enquanto a validação local não passa. */
  podeSalvar?: (valores: T) => boolean;
  rotuloSalvar?: string;
  largura?: string;
  children: (
    valores: T,
    definir: DefinirCampo<T>,
    atualizar: (patch: Partial<T>) => void,
  ) => ReactNode;
};

export function FormSheet<T extends object>({
  titulo,
  descricao,
  trigger,
  valorInicial,
  onSubmit,
  podeSalvar,
  rotuloSalvar = "Salvar",
  largura = "sm:max-w-lg",
  children,
}: Props<T>) {
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState<T>(valorInicial);
  const [salvando, setSalvando] = useState(false);
  const podeEditar = usePodeEditar();

  // Acesso de consulta não vê formulários de criação/edição.
  if (!podeEditar) return null;

  function abrirOuFechar(proximo: boolean) {
    if (proximo) setValores(valorInicial());
    setAberto(proximo);
  }

  const definir: DefinirCampo<T> = (campo, valor) =>
    setValores((atual) => ({ ...atual, [campo]: valor }));

  const atualizar = (patch: Partial<T>) => setValores((atual) => ({ ...atual, ...patch }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await onSubmit(valores);
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  const bloqueado = salvando || (podeSalvar ? !podeSalvar(valores) : false);

  return (
    <Sheet open={aberto} onOpenChange={abrirOuFechar}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className={`flex w-full flex-col gap-0 p-0 ${largura}`}>
        {/* pr-12 deixa espaço para o botão de fechar, posicionado em absoluto. */}
        <SheetHeader className="space-y-1 border-b p-4 pr-12">
          <SheetTitle>{titulo}</SheetTitle>
          {descricao && <SheetDescription className="text-xs">{descricao}</SheetDescription>}
        </SheetHeader>
        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {children(valores, definir, atualizar)}
          </div>
          <div className="flex justify-end gap-2 border-t bg-background p-4">
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={bloqueado}>
              {salvando ? "Salvando…" : rotuloSalvar}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Campo rotulado, com dica opcional. Mantém o espaçamento igual em todos os formulários. */
export function Field({
  label,
  children,
  dica,
  obrigatorio,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  dica?: string;
  obrigatorio?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
        {obrigatorio && (
          <span className="text-destructive" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
      {dica && <p className="text-[11px] text-muted-foreground">{dica}</p>}
    </div>
  );
}

/** Duas colunas em telas médias, uma em telas estreitas. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
