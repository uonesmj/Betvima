package com.betvima.app.ui

import android.content.Context
import android.content.Intent
import android.content.ClipData
import android.content.ClipboardManager
import android.provider.Settings
import android.os.Build
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import android.util.Base64

/** Device-only preferences; never used to change server payout or notification delivery. */
internal class SettingsDevice87(context: Context) {
    private val app = context.applicationContext
    private val prefs = app.getSharedPreferences("bv_device_settings_87", Context.MODE_PRIVATE)
    fun theme(): String = prefs.getString("appearance", "system") ?: "system"
    fun setTheme(value: String) { require(value in setOf("system", "light", "dark")); prefs.edit().putString("appearance", value).apply() }
    fun betAlerts(): Boolean = prefs.getBoolean("bet_alerts", true)
    fun setBetAlerts(value: Boolean) { prefs.edit().putBoolean("bet_alerts", value).apply() }
    fun appAlerts(): Boolean = prefs.getBoolean("in_app_alerts", true)
    fun setAppAlerts(value: Boolean) { prefs.edit().putBoolean("in_app_alerts", value).apply() }
    fun hasPin(): Boolean = prefs.contains("pin_hash") && prefs.contains("pin_salt")
    private fun derive(pin: String, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(pin.toCharArray(), salt, 160_000, 256)
        return try { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded }
        finally { spec.clearPassword() }
    }
    fun setPin(pin: String) {
        require(pin.matches(Regex("[0-9]{6}")))
        val salt = ByteArray(24).also { SecureRandom().nextBytes(it) }
        val digest = derive(pin, salt)
        prefs.edit().putString("pin_hash", Base64.encodeToString(digest, Base64.NO_WRAP))
            .putString("pin_salt", Base64.encodeToString(salt, Base64.NO_WRAP)).commit()
    }
    fun checkPin(pin: String): Boolean {
        if (!pin.matches(Regex("[0-9]{6}"))) return false
        val expected = prefs.getString("pin_hash", null) ?: return false
        val saltEncoded = prefs.getString("pin_salt", null) ?: return false
        return runCatching {
            java.security.MessageDigest.isEqual(
                Base64.decode(expected, Base64.NO_WRAP),
                derive(pin, Base64.decode(saltEncoded, Base64.NO_WRAP))
            )
        }.getOrDefault(false)
    }
    fun removePin(pin: String): Boolean {
        if (!checkPin(pin)) return false
        return prefs.edit().remove("pin_hash").remove("pin_salt").commit()
    }
    fun clearDisposableCache(): Long {
        val dir = app.cacheDir
        fun clean(folder: java.io.File): Long {
            if (!folder.exists()) return 0L
            if (folder.isFile) { val size = folder.length(); return if (folder.delete()) size else 0L }
            return folder.listFiles()?.sumOf(::clean) ?: 0L
        }
        return dir.listFiles()?.sumOf(::clean) ?: 0L
    }
}

internal fun shareBetvima(context: Context) {
    val url = "https://betvima.com"
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "BetVima • https://betvima.com")
    }
    context.startActivity(Intent.createChooser(intent, "Share BetVima"))
}

internal fun copyText87(context: Context, label: String, value: String) {
    (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
        .setPrimaryClip(ClipData.newPlainText(label, value))
}

internal fun openProxySettings87(context: Context) {
    // Do not silently proxy passwords, tokens, casino callbacks, or finance calls
    // through an untrusted server. Use OS-managed network proxy configuration.
    context.startActivity(Intent(Settings.ACTION_WIFI_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}
