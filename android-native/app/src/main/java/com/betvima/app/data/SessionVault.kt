package com.betvima.app.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

/** Pending AAL1 login lives only in ViewModel memory until Supabase TOTP verification. */
class TotpChallengeRequired(val firstFactorSession: JSONObject, val factorId: String) :
    Exception("TOTP verification required")

/** Android Keystore encrypted sessions; no backup or plaintext token fallback. */
class SessionVault(context: Context, scope: String = "member") {
    // Keep affiliate credentials in a separate encrypted store. No accidental
    // crossover into the sportsbook's financial/member session.
    private val prefs = context.applicationContext.getSharedPreferences(
        if (scope == "affiliate") "native_session_affiliate" else "native_session",
        Context.MODE_PRIVATE
    )
    private val keyAlias = "betvima_session_aes_v1"
    private val mutex = Mutex()
    private var memory: JSONObject? = null

    private fun key(): java.security.Key {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        store.getKey(keyAlias, null)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).setKeySize(256).build())
        return generator.generateKey()
    }
    private fun read(): JSONObject? {
        memory?.let { return it }
        val encoded = prefs.getString("session", null) ?: return null
        return runCatching {
            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
            require(bytes.size > 12)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
            JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
        }.getOrElse {
            prefs.edit().remove("session").apply()
            null
        }.also { memory = it }
    }
    private fun save(value: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.iv + cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8))
        prefs.edit().putString("session", Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
        memory = value
    }
    fun signedIn(): Boolean = read()?.optString("refresh_token")?.isNotBlank() == true

    suspend fun signIn(email: String, password: String, api: ApiClient) = mutex.withLock {
        val value = api.login(email.trim(), password)
        val access = value.optString("access_token")
        require(access.isNotBlank() && value.optString("refresh_token").isNotBlank()) {
            "Incomplete authentication response"
        }
        // Supabase owns factor status. Never persist an AAL1 session for a user
        // who has opted into TOTP; BetVima's financial endpoints reject AAL1.
        val factor = api.mfaFactors(access).firstOrNull()
        if (factor != null) throw TotpChallengeRequired(value, factor)
        // The bearer token is not considered an authenticated BetVima account
        // until the *BetVima server* validates it through withUser ownership guards.
        val verified = api.get("/api/v1/account/profile", access)
        val session = verified.optJSONObject("session")
        require(session != null && session.optString("id").isNotBlank()) {
            "Could not validate account session"
        }
        save(value.put("local_expires_at", System.currentTimeMillis() / 1000L +
            value.optLong("expires_in", 3600)))
    }
    /** After Supabase has returned AAL2 tokens, verify BetVima ownership
     * before persisting the upgraded session to the Android Keystore.
     */
    suspend fun commitVerifiedMfaSession(value: JSONObject, api: ApiClient) = mutex.withLock {
        val access = value.optString("access_token")
        require(access.isNotBlank() && value.optString("refresh_token").isNotBlank())
        val verified = api.get("/api/v1/account/profile", access)
        require(verified.optJSONObject("session")?.optString("id").orEmpty().isNotBlank())
        save(value.put("local_expires_at", System.currentTimeMillis() / 1000L +
            value.optLong("expires_in", 3600)))
    }

    /** Log in to a *separate* partner identity using its registered email.
     * Supabase authenticates; BetVima's withAffiliate guard must then verify
     * role, ownership and partner association before persisting this session.
     */
    suspend fun signInAffiliate(email: String, password: String, api: ApiClient) = mutex.withLock {
        val session = api.login(email.trim(), password)
        val jwt = session.optString("access_token")
        require(jwt.isNotBlank() && session.optString("refresh_token").isNotBlank()) {
            "Incomplete partner authentication response"
        }
        val overview = api.get("/api/v1/affiliate/overview", jwt)
        require(overview.optJSONObject("affiliate")?.optString("id").orEmpty().isNotBlank()) {
            "No authorized affiliate account"
        }
        save(session.put("local_expires_at", System.currentTimeMillis() / 1000L +
            session.optLong("expires_in", 3600)))
    }

    suspend fun accessToken(api: ApiClient): String? = mutex.withLock {
        val current = read() ?: return@withLock null
        if (current.optLong("local_expires_at", 0) > System.currentTimeMillis() / 1000L + 90) {
            return@withLock current.optString("access_token").takeIf { it.isNotBlank() }
        }
        return@withLock try {
            val fresh = api.refresh(current.optString("refresh_token"))
            save(fresh.put("local_expires_at", System.currentTimeMillis() / 1000L +
                fresh.optLong("expires_in", 3600)))
            fresh.optString("access_token").takeIf { it.isNotBlank() }
        } catch (ex: Exception) {
            // Only a definitive authentication rejection invalidates the stored
            // session. Network errors/timeouts must NEVER log a user out.
            if (ex is ApiFailure && ex.code in setOf(400, 401, 403)) {
                memory = null
                prefs.edit().remove("session").apply()
            }
            null
        }
    }
    fun clear() {
        memory = null
        prefs.edit().remove("session").apply()
    }
}
