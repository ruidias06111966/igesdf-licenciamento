/**
 * Apresentação partilhada dos despachos: a "folha" A4 e as ações de cópia.
 *
 * Fica separada dos ecrãs porque despacho por unidade e consolidado da rede
 * mostram exatamente o mesmo documento — muda apenas quem o monta.
 */
import { toast } from "sonner";
import { Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  blocosParaHtml,
  blocosParaMarkdown,
  blocosParaTexto,
  type Bloco,
} from "@/lib/despacho/nucleo";

async function copiar(texto: string, html?: string) {
  try {
    if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([texto], { type: "text/plain" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(texto);
    }
    toast.success("Copiado para a área de transferência");
  } catch {
    toast.error("O navegador bloqueou a cópia. Selecione o texto e copie manualmente.");
  }
}

export function AcoesCopiar({ blocos }: { blocos: Bloco[] }) {
  return (
    <div className="flex flex-wrap gap-2 no-print">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void copiar(blocosParaTexto(blocos), blocosParaHtml(blocos))}
      >
        <Copy className="mr-1 size-3.5" aria-hidden="true" /> Copiar para o SEI
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void copiar(blocosParaTexto(blocos))}
      >
        <FileText className="mr-1 size-3.5" aria-hidden="true" /> Copiar texto simples
      </Button>
    </div>
  );
}

export function markdownDe(blocos: Bloco[]) {
  return blocosParaMarkdown(blocos);
}

/** Pré-visualização em folha A4, com serifa, tal como sai impressa. */
export function FolhaDespacho({ blocos }: { blocos: Bloco[] }) {
  return (
    <article className="print-area mx-auto w-full max-w-[210mm] space-y-3 rounded-lg border bg-card p-6 font-serif text-[13px] leading-relaxed sm:p-10">
      {blocos.map((b, i) => {
        switch (b.t) {
          case "titulo":
            return (
              <h2 key={i} className="pt-2 text-[14px] font-bold uppercase">
                {b.texto}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="text-justify" dangerouslySetInnerHTML={{ __html: negrito(b.texto) }} />
            );
          case "lista":
            return (
              <ul key={i} className="list-disc space-y-1 pl-6">
                {b.itens.map((it, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: negrito(it) }} />
                ))}
              </ul>
            );
          case "tabela":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      {b.cab.map((c) => (
                        <th key={c} className="border px-2 py-1 text-left font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.linhas.map((l, j) => (
                      <tr key={j}>
                        {l.map((c, k) => (
                          <td key={k} className="border px-2 py-1 align-top">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "assinatura":
            return (
              <div key={i} className="space-y-6 pt-6">
                <p>{b.local}</p>
                <div className="flex flex-wrap gap-10">
                  {b.linhas.map((a, j) => (
                    <div key={j} className="min-w-[200px]">
                      <div className="border-t pt-1 font-semibold">{a.nome}</div>
                      <div className="text-[11px]">{a.cargo}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
        }
      })}
    </article>
  );
}

function negrito(t: string) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
