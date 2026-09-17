import { Injectable } from '@nestjs/common';
import { NotificationTemplateVersion, TemplateModel } from './notification.types';

export interface RenderedTemplate {
  subject?: string;
  body: string;
}

const VARIABLE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Pure (version, model) -> subject/body function. Deterministic,
 * provider-agnostic, no side effects — knows nothing about a channel or
 * provider. Interpolates `{{key}}`/`{{a.b}}` placeholders against the flat
 * model; a missing key renders as an empty string rather than throwing, so a
 * template author's typo fails a lint pass, not a recipient's send.
 */
@Injectable()
export class TemplateRenderer {
  render(version: NotificationTemplateVersion, model: TemplateModel): RenderedTemplate {
    return {
      subject: version.subject ? interpolate(version.subject, model) : undefined,
      body: interpolate(version.body, model),
    };
  }
}

function interpolate(source: string, model: TemplateModel): string {
  return source.replace(VARIABLE_PATTERN, (_match, path: string) => {
    const value = resolvePath(model, path);
    return formatValue(value);
  });
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

function resolvePath(model: TemplateModel, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, model);
}
