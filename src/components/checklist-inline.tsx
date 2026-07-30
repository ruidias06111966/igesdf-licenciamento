import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CHECKLIST_STATUS_LABEL, type StatusChecklist } from "@/lib/domain";
import { mensagemErro } from "@/lib/errors";
import { getChecklist, updateChecklistItem } from "@/lib/licencas.functions";
import { chaves } from "@/lib/queries";

type PatchChecklist = {
  id: string;
  status?: StatusChecklist;
  responsavel?: string | null;
  data_conclusao?: string | null;
  observacoes?: string | null;
};

/**
 * Checklist do processo de uma licença. Os itens são semeados a partir do
 * template do órgão na primeira abertura.
 */
export function ChecklistInline({ licencaId }: { licencaId: string }) {
  const qc = useQueryClient();
  const { data: itens, isLoading } = useQuery({
    queryKey: chaves.checklist(licencaId),
    queryFn: () => getChecklist({ data: { licenca_id: licencaId } }),
  });
  const atualizar = useMutation({
    mutationFn: (patch: PatchChecklist) => updateChecklistItem({ data: patch }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chaves.checklist(licencaId) }),
    onError: (erro) => toast.error(mensagemErro(erro)),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!itens || itens.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Ainda não existe template de checklist cadastrado para este órgão.
      </p>
    );
  }

  const concluidos = itens.filter((i) => i.status === "concluido").length;
  const percentagem = Math.round((concluidos / itens.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide uppercase text-muted-foreground">
          <ListChecks className="size-4" aria-hidden="true" /> Checklist do processo
        </div>
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <Progress value={percentagem} className="h-1.5" />
          <span className="shrink-0 text-xs text-muted-foreground">
            {concluidos}/{itens.length}
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {itens.map((item) => (
          <li
            key={item.id}
            className="grid gap-2 rounded-md border bg-background p-2.5 md:grid-cols-12 md:items-center"
          >
            <div className="md:col-span-5">
              <div className="text-sm font-medium">
                <span className="mr-1.5 text-xs text-muted-foreground">#{item.ordem}</span>
                {item.titulo}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.tipo === "documento" ? "Documento" : "Etapa"}
                {item.descricao ? ` • ${item.descricao}` : ""}
              </div>
            </div>
            <div className="md:col-span-3">
              <Select
                value={item.status}
                onValueChange={(valor) =>
                  atualizar.mutate({ id: item.id, status: valor as StatusChecklist })
                }
              >
                <SelectTrigger className="h-8" aria-label={`Situação de ${item.titulo}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHECKLIST_STATUS_LABEL).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Input
                className="h-8"
                placeholder="Responsável"
                aria-label={`Responsável por ${item.titulo}`}
                defaultValue={item.responsavel ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (item.responsavel ?? "")) {
                    atualizar.mutate({ id: item.id, responsavel: e.target.value || null });
                  }
                }}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                className="h-8"
                type="date"
                aria-label={`Conclusão de ${item.titulo}`}
                defaultValue={item.data_conclusao ?? ""}
                onChange={(e) =>
                  atualizar.mutate({ id: item.id, data_conclusao: e.target.value || null })
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
