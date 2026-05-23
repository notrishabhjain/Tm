package expo.modules.notificationlistener

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import java.util.LinkedHashMap

class TaskMindNotificationListenerService : NotificationListenerService() {

    companion object {
        const val ACTION_REFRESH_FILTER = "com.taskmind.REFRESH_FILTER"
        private const val DEDUP_WINDOW_MS = 5000L
        private const val DEDUP_CACHE_MAX = 100
        private const val MAX_THREAD_MESSAGES = 10

        private val CARRIER_SENDER_REGEX = Regex("""^[A-Z]{2,3}-[A-Z0-9]{3,8}$""")
        private val OTP_DIGIT_REGEX = Regex("""\b\d{4,8}\b""")
        private val AGGREGATE_BADGE_REGEX = Regex("""^\d+ new (message|notification|email|mail)""", RegexOption.IGNORE_CASE)

        private val SYSTEM_PACKAGE_PREFIXES = listOf(
            "com.android.",
            "com.google.android.gms",
            "com.miui.",
            "com.vivo.",
            "com.qualcomm."
        )
    }

    private val dedupCache = object : LinkedHashMap<String, Long>(DEDUP_CACHE_MAX, 0.75f, true) {
        override fun removeEldestEntry(eldest: Map.Entry<String, Long>) = size > DEDUP_CACHE_MAX
    }

    private var monitoredApps: Set<String> = emptySet()

    private val refreshReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            loadMonitoredApps()
        }
    }

    override fun onCreate() {
        super.onCreate()
        loadMonitoredApps()
        val filter = IntentFilter(ACTION_REFRESH_FILTER)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(refreshReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(refreshReceiver, filter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(refreshReceiver)
        } catch (_: Exception) { }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        val serviceIntent = Intent(this, TaskMindForegroundService::class.java)
        startForegroundService(serviceIntent)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName ?: return

        // Skip our own notifications
        if (packageName == applicationContext.packageName) return

        // Filter by monitored apps (empty set = monitor all)
        if (monitoredApps.isNotEmpty() && !monitoredApps.contains(packageName)) return

        val extras: Bundle = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString() ?: return
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: text

        // Hard discard filter (applied before deduplication)
        if (shouldDiscard(packageName, title, text, bigText)) return

        // Deduplication: same (package, title, text) within 5 seconds
        val dedupKey = "$packageName|$title|$text"
        val now = System.currentTimeMillis()
        val lastSeen = dedupCache[dedupKey]
        if (lastSeen != null && (now - lastSeen) < DEDUP_WINDOW_MS) return
        dedupCache[dedupKey] = now

        val appName = try {
            packageManager.getApplicationLabel(
                packageManager.getApplicationInfo(packageName, 0)
            ).toString()
        } catch (_: Exception) {
            packageName
        }

        val subText = extras.getCharSequence("android.subText")?.toString() ?: ""
        val isGroup = subText.isNotBlank() || sbn.notification.group != null

        // Extract MessagingStyle conversation thread
        val thread: List<Map<String, Any>> = extractThread(sbn)

        // Extract Android metadata
        val category = sbn.notification.category ?: ""
        val channelId = sbn.notification.channelId ?: ""
        val importance = try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.getNotificationChannel(channelId)?.importance ?: 3
        } catch (_: Exception) {
            3
        }

        val data = mapOf(
            "packageName" to packageName,
            "appName" to appName,
            "title" to title,
            "text" to text,
            "bigText" to bigText,
            "subText" to subText,
            "postTime" to sbn.postTime,
            "isGroup" to isGroup,
            "thread" to thread,
            "category" to category,
            "channelId" to channelId,
            "importance" to importance
        )

        NotificationListenerModule.sendNotificationEvent(data)
    }

    private fun extractThread(sbn: StatusBarNotification): List<Map<String, Any>> {
        val style = NotificationCompat.MessagingStyle
            .extractMessagingStyleFromNotification(sbn.notification)
            ?: return emptyList()

        return style.messages
            .takeLast(MAX_THREAD_MESSAGES)
            .map { message ->
                mapOf(
                    "sender" to (message.person?.name?.toString() ?: ""),
                    "text" to (message.text?.toString() ?: ""),
                    "timestamp" to message.timestamp
                )
            }
    }

    private fun shouldDiscard(
        packageName: String,
        title: String,
        text: String,
        bigText: String
    ): Boolean {
        // Zero content
        if (text.isBlank() && bigText.isBlank()) return true

        // System/sync packages
        if (SYSTEM_PACKAGE_PREFIXES.any { packageName.startsWith(it) }) return true

        // Carrier sender ID pattern (e.g. "VM-AMAZON", "AD-HDFC")
        if (CARRIER_SENDER_REGEX.matches(title)) return true

        // OTP/verification messages
        if (OTP_DIGIT_REGEX.containsMatchIn(text) &&
            (text.contains("OTP", ignoreCase = true) ||
             text.contains("verification code", ignoreCase = true) ||
             text.contains("one time", ignoreCase = true))
        ) return true

        // Aggregate badge notifications
        if (AGGREGATE_BADGE_REGEX.containsMatchIn(text)) return true

        return false
    }

    private fun loadMonitoredApps() {
        val prefs = getSharedPreferences("taskmind_prefs", Context.MODE_PRIVATE)
        monitoredApps = prefs.getStringSet("monitored_apps", emptySet()) ?: emptySet()
    }
}
