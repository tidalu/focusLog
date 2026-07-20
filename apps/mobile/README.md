# FocusLog Mobile

FocusLog Android is a local-first Flutter application. Local SQLite is authoritative during network loss; its outbox worker retries acknowledged operations only. Android notifications and WorkManager are used within normal Android limits: force-stop, denied notification permission, battery optimization, and OEM task management can delay work. The app never attempts to bypass those controls and recovers durable reminders when it next runs.

Before the first Android package build, generate or refresh platform wrappers if your Flutter version requires it:

```powershell
flutter create --platforms=android .
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

For a signed release APK, copy `android/key.properties.example` to `android/key.properties`, set its values, and keep the keystore outside version control. Without a keystore, the Gradle release configuration uses the debug signing key only for development/CI validation.

```powershell
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter test
flutter build apk --release --dart-define=FOCUSLOG_API_URL=https://your-server.example
```
