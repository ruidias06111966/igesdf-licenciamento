#!/usr/bin/env node
/**
 * Fast CSS syntax validator. Parses src/styles.css with lightningcss (the
 * same engine Tailwind v4 uses) so we catch nested `@page`, malformed
 * `@import`, and other syntax errors BEFORE `vite build` fails and the
 * dev server returns 500 for `/src/styles.css`.
 *
 * Run: `bun run validate:css`
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = resolve(__dirname, "..", "src", "styles.css");
const source = readFileSync(file, "utf8");

const errors = [];

// 1. Nested @page — the exact class of error that caused the Vite 500 in
//    development. lightningcss / Tailwind's parser rejects @page inside any
//    other block, so we grep for it explicitly.
//    Allowed: top-level `@page`, `@page name`, `@page { ... }`.
//    Forbidden: `selector { @page ... }` or `@media print { @page ... }`.
{
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, ""); // drop comments
  // Walk tokens with a small depth counter.
  let depth = 0;
  const re = /[{}]|@page\b/g;
  let m;
  while ((m = re.exec(stripped))) {
    if (m[0] === "{") depth++;
    else if (m[0] === "}") depth = Math.max(0, depth - 1);
    else if (depth > 0) {
      const line = stripped.slice(0, m.index).split("\n").length;
      errors.push(
        `@page nested inside another block at line ${line}. @page must be top-level; use body.print-portrait { page: portrait } instead.`,
      );
    }
  }
}

// 2. Optional deeper parse via lightningcss when installed. Tailwind directives
//    (`@source`, `@theme`, `@custom-variant`, `@utility`) are not valid CSS,
//    so we strip them before parsing.
try {
  const lightning = await import("lightningcss");
  const stripped = source
    .replace(/@source[^;]*;/g, "")
    .replace(/@custom-variant[^;]*;/g, "")
    .replace(/@import\s+["']tw-animate-css["'][^;]*;/g, "")
    .replace(/@import\s+["']tailwindcss["'][^;]*;/g, "")
    .replace(/@theme[^{]*\{[\s\S]*?\n\}/g, "")
    .replace(/@utility[^{]*\{[\s\S]*?\n\}/g, "");
  try {
    lightning.transform({ filename: file, code: Buffer.from(stripped), errorRecovery: false });
  } catch (err) {
    errors.push(`lightningcss: ${err.message || err}`);
  }
} catch {
  // lightningcss not installed — best-effort only, skip.
}

if (errors.length) {
  console.error("[validate-css] FAILED — src/styles.css:");
  for (const e of errors) console.error("  •", e);
  process.exit(1);
}
console.log("[validate-css] OK — src/styles.css parses cleanly.");
