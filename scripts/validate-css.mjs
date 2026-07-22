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

// Load lightningcss lazily; it ships transitively with @tailwindcss/vite.
let lightning;
try {
  lightning = await import("lightningcss");
} catch {
  console.warn("[validate-css] lightningcss not installed — skipping. Install it or rely on Vite for validation.");
  process.exit(0);
}

// Ignore Tailwind-specific at-rules that lightningcss doesn't know natively.
// We just want a syntax pass here.
try {
  lightning.transform({
    filename: file,
    code: Buffer.from(source),
    minify: false,
    errorRecovery: false,
  });
  console.log("[validate-css] OK — src/styles.css parses cleanly.");
} catch (err) {
  console.error("[validate-css] FAILED — src/styles.css has a syntax error:");
  console.error(err.message || err);
  process.exit(1);
}