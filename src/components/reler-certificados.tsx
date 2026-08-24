import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CertificadoAnalise } from "@/components/certificado-analise";
import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteDocumento } from "@/lib/licencas.functions";
import { analisarCertificado, listarCertificados } from "@/lib/certificado.functions";
import type { AnaliseCertificado } from "@/lib/certificado";
import { formatDate } from "@/lib/domain";
import { mensagemErro } from "@/lib/errors";
import { usePodeEditar } from "@/lib/perfil";

/**
 * Releitura de certificados já arquivados.
 *
 * Corre um de cada vez e mostra o quadro de diferenças: o utilizador aprova
 * (ou fecha) antes de passar ao seguinte. A leitura em lote sem confirmação
 * seria o oposto da regra do módulo — o certificado nunca escreve sozinho.
 */
export function RelerCertificados() {
  const podeEditar = usePodeEditar();
  const [analise, setAnalise] = useState<AnaliseCertificado | null>(null);
  const [aLer, setALer] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["certificados-arquivados"],
    queryFn: () => listarCertificados(),
    enabled: podeEditar,
  });

  if (!podeEditar) return null;

  async function reler(doc: { id: string; unidade_id: string | null; storage_path: string }) {
    if (!doc.unidade_id) {
      toast.error("Este certificado não está associado a nenhuma unidade.");
      return;
    }
    setALer(doc.id);
    try {
      setAnalise(
        await analisarCertificado({
          data: {
            unidade_id: doc.unidade_id,
            storage_path: doc.storage_path,
            documento_id: doc.id,
          },
        }),
      );
    } catch (erro) {
      toast.error(mensagemErro(erro));
    } finally {
      setALer(null);
    }
  }

  const legiveis = (data ?? []).filter(
    (d) => !d.mime_type || d.mime_type === "application/pdf" || d.mime_type.startsWith("image/"),
  );

  return (
    <>
      <Card className="no-print">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch className="size-4" aria-hidden="true" /> Reler certificados arquivados
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Reprocessa um certificado já guardado e mostra as diferenças face às licenças
            registradas — inclusive as condicionantes e restrições. Nada é gravado sem a sua
            confirmação.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">A carregar certificados arquivados…</p>
          )}
          {error && <p className="text-sm text-destructive">{mensagemErro(error)}</p>}
          {!isLoading && !error && legiveis.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ainda não há certificados arquivados legíveis.
            </p>
          )}
          {legiveis.length > 0 && (
            <ul className="divide-y rounded-md border">
              {legiveis.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 p-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.unidade_nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.nome} · arquivado em {formatDate(d.created_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reler(d)}
                    disabled={aLer !== null}
                  >
                    {aLer === d.id ? (
                      <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="mr-1 size-4" aria-hidden="true" />
                    )}
                    Reler
                  </Button>
                  <ConfirmDelete
                    titulo="Excluir certificado arquivado"
                    descricao={`O ficheiro "${d.nome}" (${d.unidade_nome}) será removido definitivamente do arquivo. As licenças já registradas não são alteradas.`}
                    mensagemSucesso="Certificado excluído"
                    onConfirm={() =>
                      deleteDocumento({ data: { id: d.id, storage_path: d.storage_path } })
                    }
                    onDone={() => qc.invalidateQueries({ queryKey: ["certificados-arquivados"] })}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {analise && <CertificadoAnalise analise={analise} onFechar={() => setAnalise(null)} />}
    </>
  );
}
