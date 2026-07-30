package com.focuslog.mobile

import android.app.Activity
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.RemoteViews
import android.widget.Switch
import android.widget.TextView
import org.json.JSONObject

internal const val PREFS = "focuslog_widget"
internal const val SNAPSHOT = "snapshot"
private const val ACTION_REFRESH = "com.focuslog.mobile.WIDGET_REFRESH"
internal const val ACTION_QUICK_ADD = "com.focuslog.mobile.action.QUICK_ADD"

internal data class WidgetOptions(
    val mode: String = "productivity",
    val privacy: String = "hidden",
    val profileId: String? = null
)

internal fun options(context: Context, appWidgetId: Int): WidgetOptions {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return WidgetOptions(
        prefs.getString("mode_$appWidgetId", "productivity") ?: "productivity",
        prefs.getString("privacy_$appWidgetId", "hidden") ?: "hidden",
        prefs.getString("profile_$appWidgetId", null)
    )
}

internal fun saveOptions(context: Context, appWidgetId: Int, options: WidgetOptions) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        .putString("mode_$appWidgetId", options.mode)
        .putString("privacy_$appWidgetId", options.privacy)
        .putString("profile_$appWidgetId", options.profileId)
        .apply()
}

class FocusLogWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { render(context, manager, it) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle
    ) = render(context, manager, appWidgetId)

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action in setOf(ACTION_REFRESH, Intent.ACTION_DATE_CHANGED, Intent.ACTION_TIMEZONE_CHANGED)) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, FocusLogWidgetProvider::class.java))
            onUpdate(context, manager, ids)
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        appWidgetIds.forEach { id ->
            editor.remove("mode_$id").remove("privacy_$id").remove("profile_$id")
        }
        editor.apply()
    }

    private fun render(context: Context, manager: AppWidgetManager, id: Int) {
        val snapshotText = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(SNAPSHOT, null)
        val snapshot = runCatching { JSONObject(snapshotText ?: "{}") }.getOrElse { JSONObject() }
        val config = options(context, id)
        val configuredProfile = config.profileId
        val actualProfile = snapshot.optString("profileId", "")
        val unavailable = configuredProfile != null && configuredProfile != actualProfile
        val size = manager.getAppWidgetOptions(id)
        val width = size.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
        val height = size.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
        val layout = when {
            width < 160 || height < 100 -> R.layout.focuslog_widget_small
            width > 280 && height > 180 -> R.layout.focuslog_widget_large
            else -> R.layout.focuslog_widget_medium
        }
        val views = RemoteViews(context.packageName, layout)
        val ready = snapshot.optInt("schemaVersion", 0) == 1 && !unavailable
        val completion = if (ready) "${snapshot.optInt("dailyCompletionPercentage", 0)}% today" else "Open FocusLog"
        views.setTextViewText(R.id.widget_completion, completion)
        if (layout != R.layout.focuslog_widget_small) {
            val summary = if (!ready) "Widget needs a local FocusLog profile. Tap Add log to reconfigure."
            else when (config.mode) {
                "minimal" -> "Private local progress"
                else -> productivitySummary(snapshot)
            }
            views.setTextViewText(R.id.widget_summary, summary)
        }
        if (layout == R.layout.focuslog_widget_large) {
            val insight = if (config.mode == "insight" && config.privacy != "hidden") {
                snapshot.optString("latestInsight", "No saved insight is available yet.")
            } else "Insights are hidden. Enable them in this widget's settings."
            views.setTextViewText(R.id.widget_insight, insight)
        }
        views.setOnClickPendingIntent(R.id.widget_add, quickAddIntent(context, id))
        manager.updateAppWidget(id, views)
    }

    private fun productivitySummary(snapshot: JSONObject): String {
        val parts = mutableListOf("${snapshot.optInt("logsToday", 0)} logs")
        val focus = snapshot.optInt("focusDurationMinutes", 0)
        if (focus > 0) parts += "$focus min focus"
        snapshot.optString("activeSessionName", "").takeIf { it.isNotBlank() }?.let { parts += "Focus: $it" }
        if (!snapshot.isNull("timeUntilNextReminderMinutes")) parts += "Reminder in ${snapshot.optInt("timeUntilNextReminderMinutes")} min"
        return parts.joinToString(" · ")
    }

    private fun quickAddIntent(context: Context, id: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .setAction(ACTION_QUICK_ADD)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
        return PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
}

class FocusLogWidgetConfigureActivity : Activity() {
    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }
        val mode = RadioGroup(this).apply {
            orientation = RadioGroup.VERTICAL
            listOf("minimal" to "Minimal", "productivity" to "Productivity", "insight" to "AI insight").forEach { (value, label) ->
                addView(RadioButton(this@FocusLogWidgetConfigureActivity).apply { text = label; tag = value; id = View.generateViewId(); if (value == "productivity") isChecked = true })
            }
        }
        val privacy = Switch(this).apply { text = "Show saved insight (never generates AI)" }
        val save = TextView(this).apply { text = "Save widget"; textSize = 18f; setPadding(0, 36, 0, 24); isClickable = true }
        setContentView(LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(48, 48, 48, 48); addView(TextView(this@FocusLogWidgetConfigureActivity).apply { text = "Configure FocusLog"; textSize = 24f }); addView(mode); addView(privacy); addView(save) })
        save.setOnClickListener {
            val selected = mode.findViewById<RadioButton>(mode.checkedRadioButtonId)
            val snapshot = runCatching { JSONObject(getSharedPreferences(PREFS, MODE_PRIVATE).getString(SNAPSHOT, "{}")) }.getOrElse { JSONObject() }
            saveOptions(this, appWidgetId, WidgetOptions(selected?.tag as? String ?: "productivity", if (privacy.isChecked) "redacted" else "hidden", snapshot.optString("profileId").ifBlank { null }))
            FocusLogWidgetProvider().onUpdate(this, AppWidgetManager.getInstance(this), intArrayOf(appWidgetId))
            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)); finish()
        }
    }
}
