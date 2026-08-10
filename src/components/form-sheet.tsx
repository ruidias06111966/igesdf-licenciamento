import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePodeEditar } from "@/lib/perfil";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  /** Mantido por compatibilidade; a janela usa agora largura ampla centrada. */
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
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {/* Janela ampla e centrada: dá espaço de leitura e escrita, em vez da
          gaveta estreita encostada à direita. */}
      <DialogContent
        className={`flex h-[95vh] max-h-[95vh] w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]`}
      >
        {/* pr-12 deixa espaço para o botão de fechar, posicionado em absoluto. */}
        <DialogHeader className="space-y-1 border-b p-4 pr-12 text-left">
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription className="text-xs">{descricao}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-4xl space-y-4">
              {children(valores, definir, atualizar)}
            </div>
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
      </DialogContent>
    </Dialog>
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
