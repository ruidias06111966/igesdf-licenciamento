import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { mensagemErro } from "@/lib/errors";

/**
 * Confirmação de remoção padronizada. Antes cada página repetia o próprio
 * `AlertDialog` com textos e rótulos ligeiramente diferentes ("Excluir" num
 * lugar, "Eliminar" noutro) e sem tratar o erro de forma consistente.
 */
export function ConfirmDelete({
  titulo,
  descricao,
  onConfirm,
  onDone,
  trigger,
  rotuloConfirmar = "Excluir",
  mensagemSucesso = "Registro excluído",
}: {
  titulo: string;
  descricao: string;
  onConfirm: () => Promise<unknown>;
  onDone?: () => void;
  trigger?: ReactNode;
  rotuloConfirmar?: string;
  mensagemSucesso?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // O diálogo fica aberto durante a remoção e só fecha no fim, para que um erro
  // apareça com o contexto ainda visível em vez de num toast sobre a lista.
  async function confirmar() {
    setOcupado(true);
    try {
      await onConfirm();
      toast.success(mensagemSucesso);
      setAberto(false);
      onDone?.();
    } catch (erro) {
      toast.error(mensagemErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label={titulo} title={titulo}>
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={ocupado}
            onClick={(e) => {
              e.preventDefault();
              void confirmar();
            }}
          >
            {ocupado ? "Excluindo…" : rotuloConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
