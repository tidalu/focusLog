import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const contract = JSON.parse(
  readFileSync(new URL('../../../contracts/ai/mobile-ai-v1.json', import.meta.url), 'utf8')
);
const typescript = readFileSync(new URL('../src/generated-contracts.ts', import.meta.url), 'utf8');
const dart = readFileSync(
  new URL('../../../apps/mobile/lib/generated/contracts.dart', import.meta.url),
  'utf8'
);

test('AI mobile contract is generated for TypeScript and Dart from one source', () => {
  assert.equal(contract.schemaVersion, 1);
  assert.match(typescript, /export const aiMobileContractVersion = 1 as const/);
  assert.match(dart, /const aiMobileContractVersion = 1;/);
  for (const jobType of contract.jobTypes) {
    assert.match(typescript, new RegExp(`'${jobType}'`));
    assert.match(dart, new RegExp(`"${jobType}"`));
  }
});

test('AI mobile ownership matrix freezes execution without mobile direct-provider execution', () => {
  assert.equal(contract.executionOwnership.daily_analysis, 'desktop_owned_execution');
  assert.equal(contract.executionOwnership.embedding_rebuild_namespace, 'desktop_owned_execution');
  assert.equal(contract.executionOwnership.fact_extract_source, 'desktop_owned_execution');
  assert.equal(contract.executionOwnership.graph_update_from_fact, 'desktop_owned_execution');
  assert.equal(contract.executionOwnership.retrieval_qa, 'desktop_owned_execution');
  assert.equal(contract.executionOwnership.playground_chat, 'desktop_only');
  assert.ok(
    !Object.values(contract.executionOwnership).includes('mobile_direct_provider_execution')
  );
});

test('AI mobile shared contract preserves exact money, errors, provenance, and redaction fields', () => {
  assert.equal(contract.money.microUnitStringPattern, '^[0-9]+$');
  assert.ok(contract.normalizedErrors.includes('BUDGET_EXCEEDED'));
  assert.ok(contract.normalizedErrors.includes('READ_ONLY_UNSUPPORTED_AI_SCHEMA'));
  assert.ok(contract.provenanceKinds.includes('provider_attempt'));
  assert.ok(contract.redactionForbiddenFields.includes('rawProviderResponse'));
  assert.match(typescript, /export const aiMobileMicroUnitPattern = '\^\[0-9\]\+\$' as const/);
  assert.match(dart, /const aiMobileMicroUnitPattern = "\^\[0-9\]\+\\\$";/);
});

test('AI mobile future schema compatibility fails safely', () => {
  assert.equal(contract.compatibility.unknownFutureVersionBehavior, 'safe_error_or_read_only');
  assert.match(typescript, /READ_ONLY_UNSUPPORTED_AI_SCHEMA/);
  assert.match(dart, /READ_ONLY_UNSUPPORTED_AI_SCHEMA/);
});
