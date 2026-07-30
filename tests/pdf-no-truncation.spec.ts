/**
 * PDF regression suite.
 *
 * For each print-enabled route we:
 *   1. Log in with the sandbox-provided Supabase session (when present).
 *   2. Apply the target orientation via body classes (matching what
 *      PrintModeToggle does at runtime).
 *   3. Emulate print media so on-screen CSS matches the paper layout.
 *   4. Detect truncated content: any element inside `.print-area` whose
 *      `scrollWidth > clientWidth` or whose computed `text-overflow` is
 *      `ellipsis` with hidden overflow.
 *   5. Export a real PDF via `page.pdf()` for manual inspection at
 *      `/tmp/pdf-out/`.
 *
 * Run: `bun run test:pdf`
 * Requires `@playwright/test` and its bundled Chromium (already available
 * in the sandbox at PLAYWRIGHT_BROWSERS_PATH).
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";
const OUT = "/tmp/pdf-out";

type Case = { path: string; orientation: "portrait" | "landscape"; label: string };

const CASES: Case[] = [
  { path: "/dashboard", orientation: "landscape", label: "dashboard" },
  { path: "/licencas", orientation: "landscape", label: "licencas" },
  { path: "/calendario", orientation: "landscape", label: "calendario" },
  { path: "/relatorios", orientation: "landscape", label: "relatorios" },
];

async function restoreSession(page: Page) {
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  const cookies = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;
  if (cookies) {
    const parsed = (JSON.parse(cookies) as Record<string, unknown>[]).map((c) => ({
      ...c,
      url: BASE,
    }));
    await page.context().addCookies(parsed);
  }
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  if (key && session) {
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [key, session]);
  }
}

async function applyPrintMode(page: Page, orientation: "portrait" | "landscape") {
  await page.evaluate((o) => {
    document.body.classList.toggle("print-portrait", o === "portrait");
    document.body.classList.toggle("print-landscape", o === "landscape");
    let el = document.getElementById("print-page-dyn") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "print-page-dyn";
      document.head.appendChild(el);
    }
    const margin = o === "portrait" ? "10mm" : "8mm";
    el.textContent = `@page { size: A4 ${o}; margin: ${margin}; }`;
  }, orientation);
  await page.emulateMedia({ media: "print" });
}

async function collectTruncated(page: Page) {
  return page.$$eval(".print-area *", (els) =>
    els
      .filter((e) => {
        const cs = getComputedStyle(e as Element);
        const overflowsX = (e as HTMLElement).scrollWidth - (e as HTMLElement).clientWidth > 1;
        const clipped =
          cs.textOverflow === "ellipsis" && (cs.overflowX === "hidden" || cs.overflow === "hidden");
        return overflowsX || clipped;
      })
      .slice(0, 10)
      .map((e) => {
        const tag = e.tagName.toLowerCase();
        const cls = (e as HTMLElement).className?.toString().slice(0, 60);
        return `${tag}.${cls}`;
      }),
  );
}

test.beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
});

for (const c of CASES) {
  test(`no truncation in ${c.label} (${c.orientation})`, async ({ page }) => {
    await restoreSession(page);
    await page.goto(BASE + c.path, { waitUntil: "networkidle" });
    await applyPrintMode(page, c.orientation);
    await page.waitForTimeout(300);

    const truncated = await collectTruncated(page);
    await page.pdf({
      path: `${OUT}/${c.label}-${c.orientation}.pdf`,
      format: "A4",
      landscape: c.orientation === "landscape",
      printBackground: true,
      margin:
        c.orientation === "portrait"
          ? { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" }
          : { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });

    expect(truncated, `truncated nodes: ${truncated.join(", ")}`).toEqual([]);
  });
}
