import type { AnalysisEvidence } from './analysis-contracts.js';

export interface EvidenceCandidate {
  id: string;
  revisionId: string;
  ownerId: string;
  submittedAt: string;
  content: string;
  deleted?: boolean;
  available?: boolean;
  privacyAllowed?: boolean;
  pinned?: boolean;
  category?: string | null;
  project?: string | null;
}
export function selectAnalysisEvidence(
  ownerId: string,
  records: EvidenceCandidate[],
  options: { maxCount: number; maxCharacters: number }
): AnalysisEvidence[] {
  const candidates = records
    .filter(
      (record) =>
        record.ownerId === ownerId &&
        !record.deleted &&
        record.available !== false &&
        record.privacyAllowed !== false
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
        b.content.length - a.content.length ||
        a.submittedAt.localeCompare(b.submittedAt) ||
        a.id.localeCompare(b.id)
    );
  const selected: AnalysisEvidence[] = [];
  let size = 0;
  for (const record of candidates) {
    const content = record.content.slice(0, Math.max(0, options.maxCharacters - size));
    if (!content && selected.length) break;
    selected.push({
      sourceId: record.id,
      revisionId: record.revisionId,
      kind: 'check_in',
      occurredAt: record.submittedAt,
      untrustedContent: content
    });
    size += content.length;
    if (selected.length >= options.maxCount || size >= options.maxCharacters) break;
  }
  return selected;
}
export function renderUntrustedEvidence(evidence: AnalysisEvidence[]): string {
  return evidence
    .map(
      (item) =>
        `[${item.sourceId}/${item.revisionId} @ ${item.occurredAt}]\n${item.untrustedContent}`
    )
    .join('\n\n');
}
