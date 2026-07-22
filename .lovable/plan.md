## Objetivo

Adicionar teste E2E de PDF, lint de CSS, toggle "Modo Impressão" com preview e fallback para @page nomeada.

## 1. Toggle "Modo Impressão" (UI)

Novo componente `src/components/print-mode-toggle.tsx`:
- Botão flutuante/no header com dropdown: Orientação (Retrato/Paisagem), Escala (75/85/100%), botão "Pré-visualizar" e "Exportar PDF".
- Aplica `document.body.classList` (`print-portrait` / `print-landscape`) e `--print-scale` CSS var.
- Preview: abre modal fullscreen simulando A4 (com `.print-preview` que replica regras `@media print` em `@media screen` via classe).

Substituir os botões `window.print()` isolados em: `dashboard.tsx`, `licencas.tsx`, `calendario.tsx`, `relatorios.tsx`, `unidades.$id.dossie.tsx` pelo componente unificado.

## 2. Fallback @page nomeada

Em `src/styles.css`:
- Manter `@page portrait { size: A4 portrait; }` + `body.print-portrait { page: portrait; }`.
- Adicionar fallback JS: `usePrintOrientation` hook injeta `<style id="print-page-dyn">@page { size: A4 portrait; margin: 10mm }</style>` no `<head>` antes de `window.print()`, e remove depois. Isso funciona mesmo em navegadores sem suporte a named pages (Firefox).
- Ajustar `@page` root para não fixar orientação — orientação vem sempre da tag injetada dinamicamente.

## 3. Lint CSS no pipeline

- `bun add -d stylelint stylelint-config-standard`
- Config `.stylelintrc.json` com regras básicas + validação sintática (detecta `@page` aninhado, `@import` fora do topo, etc.).
- Script `package.json`: `"lint:css": "stylelint 'src/**/*.css'"`.
- Adicionar chamada `lint:css` ao script `lint` existente.

Também validar via lightningcss diretamente:
- Script `scripts/validate-css.mjs` que corre `lightningcss` (já dependência do Tailwind v4) sobre `src/styles.css` e falha se houver erro de parsing. Integrado em `lint`.

## 4. Teste automatizado de PDF (Playwright)

`tests/pdf-no-truncation.spec.ts` (Playwright):
- Faz login (usa `LOVABLE_BROWSER_SUPABASE_*` do sandbox).
- Percorre rotas: `/dashboard`, `/licencas`, `/calendario`, `/relatorios`, `/unidades/:id`, `/unidades/:id/dossie`.
- Em cada rota, aplica classe `.print-portrait` ou landscape, chama `page.pdf({ format: 'A4', landscape, printBackground: true })`.
- Salva em `/tmp/pdf-out/`.
- Valida ausência de truncamento comparando `scrollWidth > clientWidth` em `.print-area *` (após aplicar media emulation `page.emulateMedia({ media: 'print' })`), garante nenhuma célula com `text-overflow: ellipsis` computado, e valida que altura do PDF gerado > 0 e nº de páginas coerente (via `pdf-parse` para contar páginas).
- Script `bun test:pdf` que corre `playwright test tests/pdf-no-truncation.spec.ts`.

Execução manual em CI local via `code--exec` no fim para validar.

## Detalhes técnicos

**CSS var de escala:**
```css
@media print { .print-area { zoom: var(--print-scale, 1); } }
```

**Hook de orientação (injeção dinâmica):**
```ts
function applyPrintOrientation(o: 'portrait'|'landscape') {
  document.body.classList.toggle('print-portrait', o==='portrait');
  document.body.classList.toggle('print-landscape', o==='landscape');
  let el = document.getElementById('print-page-dyn');
  if (!el) { el = document.createElement('style'); el.id='print-page-dyn'; document.head.appendChild(el); }
  el.textContent = `@page { size: A4 ${o}; margin: ${o==='portrait'?'10mm':'8mm'}; }`;
}
```

**Detecção de truncamento no teste:**
```ts
const bad = await page.$$eval('.print-area *', els => els.filter(e => {
  const cs = getComputedStyle(e);
  return (cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible')
      || e.scrollWidth - e.clientWidth > 1;
}).map(e => e.tagName + '.' + e.className));
expect(bad).toEqual([]);
```

## Ordem de execução

1. Instalar deps (`stylelint`, `stylelint-config-standard`, `@playwright/test`, `pdf-parse`).
2. Criar `.stylelintrc.json` + `scripts/validate-css.mjs`.
3. Atualizar `src/styles.css` (fallback + var de escala).
4. Criar `src/components/print-mode-toggle.tsx`.
5. Trocar botões de imprimir nas 5 rotas.
6. Criar `tests/pdf-no-truncation.spec.ts` + config Playwright mínima.
7. Correr `bun lint:css` e o teste para validar.
