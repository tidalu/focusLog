import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'Android manifest declares networking and recovery permissions without battery bypass',
    () {
      final manifest =
          File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

      expect(manifest, contains('android.permission.INTERNET'));
      expect(manifest, contains('android.permission.USE_FULL_SCREEN_INTENT'));
      expect(manifest,
          contains('android.permission.FOREGROUND_SERVICE_SPECIAL_USE'));
      expect(manifest, contains('android.permission.POST_NOTIFICATIONS'));
      expect(manifest, contains('android.permission.RECEIVE_BOOT_COMPLETED'));
      expect(manifest, contains('ScheduledNotificationBootReceiver'));
      expect(manifest, contains('flutterlocalnotifications.ForegroundService'));
      expect(manifest, contains('android:showWhenLocked="true"'));
      expect(manifest, contains('android:turnScreenOn="true"'));
      expect(manifest, contains('android:allowBackup="false"'));
      expect(manifest, contains('android:usesCleartextTraffic="false"'));
      expect(
        manifest,
        isNot(contains(
            'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS')),
      );
    },
  );

  test('release builds never fall back to the Android debug key', () {
    final gradle = File('android/app/build.gradle').readAsStringSync();

    expect(gradle, contains('A release signing key is required'));
    expect(gradle, isNot(contains('signingConfigs.debug')));
  });

  test('mandatory reminder screen has no in-application dismissal control', () {
    final source = File('lib/main.dart').readAsStringSync();
    final reminderSource = source.substring(
      source.indexOf('class _ReminderScreen'),
      source.indexOf('class _History'),
    );

    expect(reminderSource, contains('canPop: _completed'));
    expect(reminderSource, contains('beginPresentation'));
    expect(reminderSource, contains('endPresentation'));
    expect(reminderSource, contains('20 - _length'));
    expect(reminderSource, isNot(contains('Snooze')));
    expect(reminderSource, isNot(contains('Emergency dismiss')));
    expect(reminderSource, isNot(contains('Cancel')));
  });
}
