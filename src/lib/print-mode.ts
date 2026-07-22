import { useEffect, useState } from "react";

export type PrintOrientation = "portrait" | "landscape";
export type PrintScale = 75 | 85 | 100;

const STORAGE_KEY = "igesdf.print-mode";
const DYN_STYLE_ID = "print-page-dyn";

export function getSavedPrintMode(): { orientation: PrintOrientation; scale: PrintScale } {
  if (typeof window === "undefined") return { orientation: "landscape", scale: 100 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { orientation: "landscape", scale: 100 };
}

/**
 * Applies print orientation + scale to <body> and injects a dynamic @page rule
 * as a fallback for browsers that ignore named @page (e.g. Firefox).
 */
export function applyPrintMode(orientation: PrintOrientation, scale: PrintScale) {
  if (typeof document === "undefined") return;
  const body = document.body;
  body.classList.toggle("print-portrait", orientation === "portrait");
  body.classList.toggle("print-landscape", orientation === "landscape");
  body.style.setProperty("--print-scale", String(scale / 100));

  let el = document.getElementById(DYN_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = DYN_STYLE_ID;
    document.head.appendChild(el);
  }
  const margin = orientation === "portrait" ? "10mm" : "8mm";
  el.textContent = `@page { size: A4 ${orientation}; margin: ${margin}; }`;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ orientation, scale }));
  } catch {}
}

export function usePrintMode() {
  const [orientation, setOrientation] = useState<PrintOrientation>("landscape");
  const [scale, setScale] = useState<PrintScale>(100);

  useEffect(() => {
    const saved = getSavedPrintMode();
    setOrientation(saved.orientation);
    setScale(saved.scale);
    applyPrintMode(saved.orientation, saved.scale);
  }, []);

  function update(next: Partial<{ orientation: PrintOrientation; scale: PrintScale }>) {
    const o = next.orientation ?? orientation;
    const s = next.scale ?? scale;
    setOrientation(o);
    setScale(s);
    applyPrintMode(o, s);
  }

  function preview() {
    applyPrintMode(orientation, scale);
    window.print();
  }

  return { orientation, scale, update, preview };
}