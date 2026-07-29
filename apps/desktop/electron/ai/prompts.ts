import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AIError } from './errors.js';
import type { AnalysisLevel } from './analysis-contracts.js';

export interface PromptDefinition {
  id: string;
  version: string;
  purpose: string;
  outputSchemaVersion: string;
  content: string;
  level?: AnalysisLevel;
  variables: string[];
  privacyClassification?: string;
  expectedContext?: string;
  changeNotes?: string;
}

function metadata(source: string): { fields: Record<string, string>; content: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(source);
  if (!match) throw new AIError('VALIDATION', 'Prompt is missing required metadata.');
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/u)) {
    const separator = line.indexOf(':');
    if (separator > 0) fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { fields, content: match[2]!.trim() };
}

export function loadBuiltinPrompt(id: string): PromptDefinition {
  if (!/^[a-z-]+$/u.test(id)) throw new AIError('VALIDATION', 'Invalid prompt identifier.');
  const source = readFileSync(join(import.meta.dirname, '../../prompts', `${id}.md`), 'utf8');
  const parsed = metadata(source);
  const definition = {
    id: parsed.fields.id,
    version: parsed.fields.version,
    purpose: parsed.fields.purpose,
    outputSchemaVersion: parsed.fields.output_schema_version,
    content: parsed.content,
    level: parsed.fields.level as AnalysisLevel | undefined,
    variables: parsed.fields.variables
      ? parsed.fields.variables
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    privacyClassification: parsed.fields.privacy_classification,
    expectedContext: parsed.fields.expected_context,
    changeNotes: parsed.fields.change_notes
  };
  if (
    !definition.id ||
    !definition.version ||
    !definition.purpose ||
    !definition.outputSchemaVersion
  )
    throw new AIError('VALIDATION', 'Prompt metadata is incomplete.');
  return definition;
}

export function renderPrompt(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/gu, (_match, name: string) => {
    if (!(name in values)) throw new AIError('VALIDATION', `Prompt variable ${name} is required.`);
    return values[name]!;
  });
}
