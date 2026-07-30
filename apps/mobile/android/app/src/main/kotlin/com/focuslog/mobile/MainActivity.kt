package com.focuslog.mobile

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val widgetChannel = "focuslog/widget"

    override fun getInitialRoute(): String? =
        if (intent?.action == ACTION_QUICK_ADD) "/quick-add" else super.getInitialRoute()

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, widgetChannel)
            .setMethodCallHandler { call, result ->
                if (call.method != "writeSnapshot") { result.notImplemented(); return@setMethodCallHandler }
                val payload = call.arguments as? Map<*, *> ?: run { result.error("invalid_snapshot", "Invalid widget snapshot.", null); return@setMethodCallHandler }
                val json = org.json.JSONObject(payload).toString()
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(SNAPSHOT, json).apply()
                val manager = AppWidgetManager.getInstance(this)
                val ids = manager.getAppWidgetIds(ComponentName(this, FocusLogWidgetProvider::class.java))
                FocusLogWidgetProvider().onUpdate(this, manager, ids)
                result.success(null)
            }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.action == ACTION_QUICK_ADD) {
            flutterEngine?.dartExecutor?.binaryMessenger?.let { messenger ->
                MethodChannel(messenger, widgetChannel).invokeMethod("quickAdd", null)
            }
        }
    }
}
