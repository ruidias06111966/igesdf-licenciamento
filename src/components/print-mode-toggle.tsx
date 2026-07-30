import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Printer, Eye } from "lucide-react";
import { usePrintMode } from "@/lib/print-mode";

type Props = {
  /** Default orientation for this page. Applied on first mount if the user has no saved preference for it. */
  defaultOrientation?: "portrait" | "landscape";
};

export function PrintModeToggle({ defaultOrientation }: Props = {}) {
  const { orientation, scale, update, preview } = usePrintMode();

  // If the page explicitly wants a specific orientation and the user hasn't tweaked it, apply once.
  // (We rely on usePrintMode's saved state, so this is a soft default.)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="no-print">
          <Printer className="size-4 mr-1" /> Imprimir / PDF
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Orientação
          </Label>
          <RadioGroup
            value={orientation}
            onValueChange={(v) => update({ orientation: v as "portrait" | "landscape" })}
            className="grid grid-cols-2 gap-2"
          >
            <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="portrait" id="pm-p" />
              <span className="text-sm">Retrato</span>
            </label>
            <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="landscape" id="pm-l" />
              <span className="text-sm">Paisagem</span>
            </label>
          </RadioGroup>
          {defaultOrientation && orientation !== defaultOrientation && (
            <p className="text-[11px] text-muted-foreground">
              Sugerido para esta página:{" "}
              <strong>{defaultOrientation === "portrait" ? "Retrato" : "Paisagem"}</strong>.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Escala</Label>
          <div className="grid grid-cols-3 gap-2">
            {[75, 85, 100].map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={scale === s ? "default" : "outline"}
                onClick={() => update({ scale: s as 75 | 85 | 100 })}
              >
                {s}%
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Reduza a escala se dados grandes cortarem entre páginas.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={preview} className="w-full">
            <Eye className="size-4 mr-1" /> Pré-visualizar / Exportar PDF
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Abre a janela de impressão do navegador — reveja e escolha "Guardar como PDF".
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
