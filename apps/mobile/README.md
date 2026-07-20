# FocusLog Mobile

FocusLog Android is a local-first Flutter application. Local SQLite is authoritative during network loss; its outbox worker retries acknowledged operations only. Android notifications and WorkManager are used within normal Android limits: force-stop, denied notification permission, battery optimization, and OEM task management can delay work. The app never attempts to bypass those controls and recovers durable reminders when it next runs.

The Android wrapper is version controlled. Do not regenerate it during routine builds because doing so can replace the pinned Gradle and signing configuration.

```powershell
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

For a signed release APK, copy `android/key.properties.example` to `android/key.properties`, set its values, and keep the keystore and properties outside version control. Release builds fail closed when signing material is unavailable. GitHub Actions reconstructs the release keystore from encrypted repository secrets.

```powershell
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter test
flutter build apk --release --dart-define=FOCUSLOG_API_URL=https://focuslog-backend.onrender.com
```
