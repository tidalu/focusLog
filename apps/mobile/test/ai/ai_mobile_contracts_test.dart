import 'package:flutter_test/flutter_test.dart';
import 'package:focuslog_mobile/generated/contracts.dart';

void main() {
  test('AI mobile generated contract round-trips ownership and schema safety', () {
    expect(aiMobileContractVersion, 1);
    expect(isReadableAiMobileSchemaVersion(1), isTrue);
    expect(aiMobileCompatibilityError(1), isNull);
    expect(aiMobileCompatibilityError(2), 'READ_ONLY_UNSUPPORTED_AI_SCHEMA');
    expect(aiMobileCompatibilityError(0), 'UNSUPPORTED_AI_SCHEMA_VERSION');

    expect(aiMobileExecutionOwnership['daily_analysis'],
        'desktop_owned_execution');
    expect(aiMobileExecutionOwnership['embedding_rebuild_namespace'],
        'desktop_owned_execution');
    expect(aiMobileExecutionOwnership['fact_extract_source'],
        'desktop_owned_execution');
    expect(aiMobileExecutionOwnership['graph_update_from_fact'],
        'desktop_owned_execution');
    expect(aiMobileExecutionOwnership['retrieval_qa'],
        'desktop_owned_execution');
    expect(aiMobileExecutionOwnership['playground_chat'], 'desktop_only');
    expect(aiMobileExecutionOwnership.values,
        isNot(contains('mobile_direct_provider_execution')));
  });

  test('AI mobile generated contract preserves exact money and safe vocabularies',
      () {
    expect(isAiMobileMicroUnitAmount('0'), isTrue);
    expect(isAiMobileMicroUnitAmount('12345678901234567890'), isTrue);
    expect(isAiMobileMicroUnitAmount('1.25'), isFalse);
    expect(isAiMobileMicroUnitAmount('-1'), isFalse);

    expect(aiMobileJobTypeWireNames, contains('daily_analysis'));
    expect(aiMobileJobStatusWireNames, contains('retry_wait'));
    expect(aiMobileNormalizedErrorWireNames, contains('BUDGET_EXCEEDED'));
    expect(aiMobileNormalizedErrorWireNames,
        contains('READ_ONLY_UNSUPPORTED_AI_SCHEMA'));
    expect(aiMobileProvenanceKindWireNames, contains('provider_attempt'));
    expect(aiMobilePrivacyModeWireNames, contains('LOCAL'));
    expect(aiMobileRedactionForbiddenFields, contains('rawProviderResponse'));
    expect(aiMobileRedactionForbiddenFields, contains('authorization'));
  });
}
