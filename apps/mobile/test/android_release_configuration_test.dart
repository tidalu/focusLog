import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Android manifest declares recovery permissions without battery bypass',
      () {
    final manifest =
        File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

    expect(manifest, contains('android.permission.POST_NOTIFICATIONS'));
    expect(manifest, contains('android.permission.RECEIVE_BOOT_COMPLETED'));
    expect(manifest, contains('ScheduledNotificationBootReceiver'));
    expect(manifest, contains('android:allowBackup="false"'));
    expect(manifest, contains('android:usesCleartextTraffic="false"'));
    expect(
      manifest,
      isNot(
          contains('android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS')),
    );
  });

  test('release builds never fall back to the Android debug key', () {
    final gradle = File('android/app/build.gradle').readAsStringSync();

    expect(gradle, contains('A release signing key is required'));
    expect(gradle, isNot(contains('signingConfigs.debug')));
  });
}
