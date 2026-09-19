import type { ComponentType } from "react";

/**
 * Dados de um template. A forma concreta varia de template para template, por
 * isso o registo só garante que é um conjunto de campos nomeados — quem
 * regista um template com props tipadas fá-lo com um `as ComponenteTemplate`.
 */
export type DadosTemplate = Record<string, unknown>;
export type ComponenteTemplate = ComponentType<DadosTemplate>;

export interface TemplateEntry {
  component: ComponenteTemplate;
  subject: string | ((data: DadosTemplate) => string);
  displayName?: string;
  previewData?: DadosTemplate;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,
};
