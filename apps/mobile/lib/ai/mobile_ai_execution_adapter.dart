import 'mobile_ai_repository.dart';
import '../sync/sync_worker.dart';

/// Mobile lifecycle boundary for AI work.
///
/// The current M-A ownership matrix is desktop-owned execution. This adapter
/// therefore persists local intent, synchronizes status, and reconstructs safe
/// state after lifecycle events; it must not run provider adapters on mobile.
class MobileAIExecutionAdapter {
  MobileAIExecutionAdapter({
    required this.repository,
    Future<SyncResult> Function()? synchronize,
  }) : _synchronize = synchronize;

  final MobileAIRepository repository;
  final Future<SyncResult> Function()? _synchronize;

  Future<MobileAIRecoverySnapshot> recoverAfterColdStart({
    String reason = 'process_start',
  }) =>
      repository.recoverLifecycleState(reason: reason);

  Future<MobileAIRecoverySnapshot> recoverAfterResume({
    String reason = 'app_resume',
  }) =>
      repository.recoverLifecycleState(reason: reason);

  Future<void> recordBackgrounded() async {
    await repository.recordLifecycleDiagnostic(
        normalizedState: 'backgrounded',
        category: 'application_lifecycle',
        safeReason: 'mobile_background',
      );
  }

  Future<void> recordSuspended() async {
    await repository.recordLifecycleDiagnostic(
        normalizedState: 'suspended',
        category: 'application_lifecycle',
        safeReason: 'mobile_suspension',
      );
  }

  Future<SyncResult> synchronizeAfterReconnect() async {
    final synchronize = _synchronize;
    if (synchronize == null) {
      await repository.recordLifecycleDiagnostic(
        normalizedState: 'queued_for_desktop',
        category: 'sync',
        safeReason: 'no_sync_worker_available',
      );
      return const SyncResult.failed('Sync worker unavailable.');
    }
    final result = await synchronize();
    await repository.recordSyncLifecycleResult(
      status: result.status,
      pushed: result.pushed,
      message: result.message,
    );
    return result;
  }

  Future<void> recordOffline() async {
    await repository.recordLifecycleDiagnostic(
        normalizedState: 'offline',
        category: 'network',
        safeReason: 'network_unavailable',
      );
  }

  Future<void> recordTokenRefreshRequired() async {
    await repository.recordLifecycleDiagnostic(
        normalizedState: 'authentication_required',
        category: 'authentication',
        safeReason: 'token_refresh_required',
      );
  }

  Future<void> recordProfileSwitch(String newOwnerId) async {
    await repository.recordLifecycleDiagnostic(
        normalizedState: 'isolated',
        category: 'profile_switch',
        safeReason: newOwnerId == repository.identity.ownerId
            ? 'same_owner'
            : 'pending_actions_remain_owner_scoped',
      );
  }

  Future<List<MobileAINotificationIntent>> notifications() =>
      repository.safeNotificationIntents();

  Future<MobileAIDeepLinkTarget> validateDeepLink({
    required String ownerId,
    required String workspaceId,
    required String targetKind,
    required String targetId,
  }) =>
      repository.validateDeepLink(
        ownerId: ownerId,
        workspaceId: workspaceId,
        targetKind: targetKind,
        targetId: targetId,
      );
}
