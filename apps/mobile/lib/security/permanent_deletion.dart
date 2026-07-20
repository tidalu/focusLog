import 'dart:io';

import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

import '../data/database/app_database.dart';
import '../identity/device_identity.dart';
import '../identity/focuslog_api_client.dart';
import 'encrypted_backup.dart';

class PermanentDeletionService {
  PermanentDeletionService({
    required this.database,
    required this.identityService,
    required this.databaseKeyService,
    required this.backupKeyService,
  });

  final AppDatabase database;
  final DeviceIdentityService identityService;
  final DatabaseKeyService databaseKeyService;
  final BackupRecoveryKeyService backupKeyService;

  Future<void> deleteAll({FocusLogApiClient? remote}) async {
    if (remote != null) await remote.permanentlyDeleteOwnerData();

    // Crypto-erasure is reliable on flash storage; sector overwrite is not.
    await databaseKeyService.delete();
    await backupKeyService.delete();
    await identityService.delete();
    await database.close();

    final directory = await getApplicationDocumentsDirectory();
    final databasePath = path.join(directory.path, 'focuslog.sqlite');
    for (final suffix in ['', '-wal', '-shm']) {
      final file = File('$databasePath$suffix');
      if (await file.exists()) await file.delete();
    }
  }
}
