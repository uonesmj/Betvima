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
    /** Legacy v0.87 six-digit PIN remains valid when no mode was stored. */
    fun lockMode88(): String = prefs.getString("lock_mode", null)
        ?: if (hasPin()) "pin" else "none"

    private fun validPattern88(value: String): Boolean {
        val nodes = value.split("-")
        return nodes.size in 4..9 &&
            nodes.all { it.length == 1 && it[0] in '0'..'8' } &&
            nodes.distinct().size == nodes.size
    }
    fun setPattern88(pattern: String) {
        require(validPattern88(pattern))
        val salt = ByteArray(24).also { SecureRandom().nextBytes(it) }
        val digest = derive(pattern, salt)
        check(prefs.edit().putString("pin_hash", Base64.encodeToString(digest, Base64.NO_WRAP))
            .putString("pin_salt", Base64.encodeToString(salt, Base64.NO_WRAP))
            .putString("lock_mode", "pattern")
            .remove("failed_attempts").remove("blocked_until").commit())
    }
    fun checkPattern88(pattern: String): Boolean {
        if (!validPattern88(pattern)) return false
        val expected = prefs.getString("pin_hash", null) ?: return false
        val salt = prefs.getString("pin_salt", null) ?: return false
        return runCatching {
            java.security.MessageDigest.isEqual(
                Base64.decode(expected, Base64.NO_WRAP),
                derive(pattern, Base64.decode(salt, Base64.NO_WRAP))
            )
        }.getOrDefault(false)
    }
    fun blockedRemainingMs88(): Long =
        (prefs.getLong("blocked_until", 0L) - System.currentTimeMillis()).coerceAtLeast(0L)

    /**
     *  1 = verified, 0 = wrong, -1 = locked out.
     * The attempt budget is shared by PIN and pattern, and survives app restarts.
     */
    fun unlock88(value: String): Int {
        if (blockedRemainingMs88() > 0L) return -1
        val valid = when (lockMode88()) {
            "pattern" -> checkPattern88(value)
            "pin" -> checkPin(value)
            else -> false
        }
        if (valid) {
            prefs.edit().remove("failed_attempts").remove("blocked_until")
                .remove("lockout_round").apply()
            return 1
        }
        val failures = prefs.getInt("failed_attempts", 0) + 1
        if (failures >= 5) {
            val rounds = prefs.getInt("lockout_round", 0).coerceIn(0, 4) + 1
            val duration = 30_000L * (1L shl (rounds - 1))
            prefs.edit().putInt("failed_attempts", 0)
                .putInt("lockout_round", rounds)
                .putLong("blocked_until", System.currentTimeMillis() + duration)
                .commit()
            return -1
        }
        prefs.edit().putInt("failed_attempts", failures).apply()
        return 0
    }
    /** Switching lock method and disabling an existing lock require the old proof. */
    fun updateLock88(mode: String, value: String, oldProof: String? = null): Boolean {
        require(mode in setOf("pin", "pattern", "none"))
        if (lockMode88() != "none" && (oldProof == null || unlock88(oldProof) != 1)) return false
        when (mode) {
            "pin" -> {
                setPin(value)
                prefs.edit().putString("lock_mode", "pin").apply()
            }
            "pattern" -> setPattern88(value)
            else -> prefs.edit().remove("pin_hash").remove("pin_salt")
                .remove("lock_mode").remove("failed_attempts")
                .remove("blocked_until").remove("lockout_round").commit()
        }
        return true
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
