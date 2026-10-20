package com.betvima.app.data

import com.betvima.app.BuildConfig
import android.content.ContentResolver
import android.net.Uri
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MultipartBody
import okhttp3.Response
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class ApiFailure(val code: Int, override val message: String, val serverCode: String? = null) : IOException(message)

/** Factor IDs and friendly names are server-authoritative, not an authentication proof. */
data class AuthenticatorFactor(val id: String, val name: String, val verified: Boolean)

/** Pure parsing: an unverified enrollment must never count as an enabled factor. */
fun parseTotpFactors(user: JSONObject): List<AuthenticatorFactor> {
    val arr = user.optJSONArray("factors") ?: JSONArray()
    return (0 until arr.length()).mapNotNull { index ->
        val factor = arr.optJSONObject(index) ?: return@mapNotNull null
        if (factor.optString("factor_type") != "totp") return@mapNotNull null
        val id = factor.optString("id")
        if (!Regex("[a-fA-F0-9-]{36}").matches(id)) return@mapNotNull null
        AuthenticatorFactor(
            id, factor.optString("friendly_name").ifBlank { "Authenticator" }.take(80),
            factor.optString("status") == "verified"
        )
    }
}



/** Omit the sport filter for Top. The web catalogue treats absent sport as all sports. */
fun upcomingQueryPath(sport: String): String {
    val base = "/api/v1/matches?live=false&page=1&pageSize=50"
    return if (sport == "all") base else base + "&sport=" +
        URLEncoder.encode(sport, "UTF-8")
}

/** Build the same backend q query used by the web sportsbook. */
fun searchQueryPath(query: String, live: Boolean): String {
    val term = query.trim()
    require(term.length in 2..80)
    return "/api/v1/matches?live=" + live.toString() +
        "&page=1&pageSize=50&q=" + URLEncoder.encode(term, "UTF-8")
}

/** Server-owned filters keep My Bets accurate across all result pages.
 * Date is a rolling UTC day boundary, not an estimate of the user's finances.
 */
data class BetHistoryQuery(
    val status: String = "all",
    val type: String = "all",
    val search: String = "",
    val days: Int = 0
)

fun betHistoryPath(query: BetHistoryQuery, page: Int, todayUtc: java.time.LocalDate =
    java.time.LocalDate.now(java.time.ZoneOffset.UTC)): String {
    require(page in 1..1000)
    require(query.days in setOf(0, 7, 30, 90))
    val statuses = when (query.status) {
        "all" -> null
        "open" -> "pending,accepted,partially_settled,manual_review"
        "settled" -> "settled,void,refunded,cancelled,cashed_out,rejected"
        else -> throw IllegalArgumentException("Invalid bet status")
    }
    val kind = when (query.type) {
        "all" -> null
        "single" -> "SINGLE"
        "multiple" -> "MULTIPLE"
        else -> throw IllegalArgumentException("Invalid bet type")
    }
    val search = query.search.trim()
    require(search.length <= 70)
    return buildString {
        append("/api/v1/bets?pageSize=30&page=")
        append(page)
        append("&sortBy=placed_at&sortDirection=desc")
        if (statuses != null) append("&status=" + URLEncoder.encode(statuses, "UTF-8"))
        if (kind != null) append("&type=" + kind)
        if (search.isNotEmpty()) append("&q=" + URLEncoder.encode(search, "UTF-8"))
        if (query.days > 0) append("&from=" +
            URLEncoder.encode(todayUtc.minusDays(query.days.toLong()).toString(), "UTF-8"))
    }
}

/** HTTPS-only read interface to BetVima. Never logs credentials or wallet contents. */
class ApiClient {
    private val client = OkHttpClient.Builder().connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS).callTimeout(20, TimeUnit.SECONDS).build()
    // Money-mutating POSTs must never be automatically replayed by OkHttp.
    private val financialClient = client.newBuilder()
        .retryOnConnectionFailure(false).build()
    // The casino launch endpoint may check the catalogue, create the provider
    // player and request a session URL sequentially. The generic 20s deadline
    // can expire before a valid Demo URL arrives. Never apply this to money POSTs.
    private val casinoDemoClient = client.newBuilder()
        .readTimeout(55, TimeUnit.SECONDS)
        .callTimeout(65, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .build()
    // A mobile upload can take longer than a typical JSON request.
    // Do not automatically retry a POST that could already be stored.
    private val supportUploadClient = client.newBuilder()
        .retryOnConnectionFailure(false)
        .writeTimeout(75, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .callTimeout(90, TimeUnit.SECONDS)
        .build()
    private val base = BuildConfig.API_BASE_URL.trimEnd('/')
    private val jsonType = "application/json".toMediaType()

    suspend fun get(path: String, token: String? = null): JSONObject = request(path, token)

    /** Server-owned, read-only wagering availability; errors fail closed. */
    suspend fun wageringAvailable(): Boolean =
        get("/api/v1/mobile/config").optBoolean("wageringEnabled", false)
    /** Registration requires a Cloudflare-verified public API call, never a bearer session. */
    suspend fun registerAccount(payload: JSONObject): JSONObject =
        request("/api/v1/auth/register", body = payload)
    /**
     * Match the existing web recovery flow: validate a one-use Cloudflare token
     * against BetVima's rate-limited endpoint, then request the email from
     * Supabase Auth. No service-role key, local password reset, or stored token.
     * The official web recovery page handles the emailed recovery session.
     */
    suspend fun sendPasswordResetLink(
        email: String, turnstileToken: String, redirectUrl: String
    ) {
        require(email.trim().length in 5..254 && email.contains('@'))
        require(turnstileToken.length in 10..2048)
        require(redirectUrl == "https://betvima.com/auth/reset-password" ||
            redirectUrl == "https://betvima.com/auth/reset-password?from=affiliate")
        // A token is bound by Turnstile to the 'forgot-password' action.
        request("/api/v1/auth/password-reset",
            body = JSONObject().put("turnstileToken", turnstileToken))
        val config = get("/api/v1/mobile/config")
        if (!config.optBoolean("authenticationConfigured"))
            throw ApiFailure(503, "Password recovery unavailable")
        val origin = config.str("supabaseUrl").trimEnd('/')
        val publicKey = config.str("supabaseAnonKey")
        val parsed = origin.toHttpUrlOrNull()
        require(parsed != null && parsed.isHttps && parsed.username.isEmpty() &&
            parsed.password.isEmpty() && parsed.encodedPath == "/" &&
            parsed.query == null && parsed.fragment == null && publicKey.isNotBlank()) {
            "Invalid public authentication configuration"
        }
        withContext(Dispatchers.IO) {
            val endpoint = origin + "/auth/v1/recover?redirect_to=" +
                URLEncoder.encode(redirectUrl, "UTF-8")
            val request = Request.Builder().url(endpoint)
                .header("apikey", publicKey)
                .header("Accept", "application/json")
                .header("Cache-Control", "no-store")
                .post(JSONObject().put("email", email.trim()).toString().toRequestBody(jsonType))
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful)
                    throw ApiFailure(response.code, "Password recovery service unavailable")
            }
        }
    }

    /** Read-only eligibility check; actual referral attribution remains server-controlled. */
    suspend fun validateReferralCode(code: String): Boolean {
        require(code.matches(Regex("[A-Z0-9_-]{3,64}")))
        return get("/api/v1/auth/referral?code=" + code).optBoolean("valid", false)
    }
    /** Account currency comes from the authenticated server profile, never a UI toggle. */
    suspend fun registeredCurrency(token: String): String {
        val response = get("/api/v1/auth/session", token)
        require(response.optBoolean("authenticated", false)) { "Authentication required" }
        val canonical = response.optJSONObject("user")?.optString("currency").orEmpty().uppercase()
        require(canonical in setOf("USD","IRR","IRT")) { "Unsupported registered currency" }
        return canonical
    }
    /** Partner signup is a separate public flow; monetary setup stays server-owned. */
    suspend fun registerAffiliate(payload: JSONObject): JSONObject =
        request("/api/v1/affiliate/register", body = payload)


    suspend fun post(path: String, value: JSONObject, token: String): JSONObject =
        request(path, token, value)
    suspend fun patch(path: String, value: JSONObject, token: String): JSONObject =
        request(path, token, value, "PATCH")
    /** Payment request uses the same idempotency key across network retries. */
    suspend fun payoutRequest(value: JSONObject, token: String, idempotencyKey: String): JSONObject =
        request("/api/v1/affiliate/payouts", token, value, "POST", idempotencyKey)

    private fun apiJson(response: Response): JSONObject {
        val raw = response.body?.string().orEmpty()
        val wrapper = runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
        if (!response.isSuccessful || !wrapper.optBoolean("ok", false)) {
            val apiError = wrapper.optJSONObject("error")
            val machineCode = apiError?.optString("code").orEmpty()
                .takeIf { it.matches(Regex("[A-Z_]{3,64}")) }
            throw ApiFailure(response.code,
                apiError?.optString("message").orEmpty()
                    .ifBlank { "Request failed: " + response.code },
                serverCode = machineCode)
        }
        return wrapper.optJSONObject("data") ?: wrapper
    }

    private suspend fun request(path: String, token: String? = null, body: JSONObject? = null,
        verb: String = "POST", idempotencyKey: String? = null,
        emptyPost: Boolean = false, casinoDemo: Boolean = false): JSONObject =
        withContext(Dispatchers.IO) {
            require(path.startsWith("/api/v1/"))
            val builder = Request.Builder().url(base + path)
                .header("Accept", "application/json").header("Cache-Control", "no-store")
            if (path == "/api/v1/account/login-history" && body != null)
                builder.header("X-Betvima-Client", "android")
            if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer " + token)
            if (idempotencyKey != null) builder.header("Idempotency-Key", idempotencyKey)
            if (body != null) builder.method(verb, body.toString().toRequestBody(jsonType))
            else if (emptyPost) builder.post(ByteArray(0).toRequestBody(null))
            (if (casinoDemo) casinoDemoClient
             else if (idempotencyKey == null && !emptyPost) client
             else financialClient)
                .newCall(builder.build()).execute().use(::apiJson)
        }

    /** Current password is checked by our authenticated backend before any update. */
    suspend fun changePassword88(token: String, current: String, next: String): JSONObject {
        require(next.length in 10..128 && current.isNotBlank())
        return try {
            post("/api/v1/account/change-password",
                JSONObject().put("currentPassword", current).put("newPassword", next), token)
        } catch (error: ApiFailure) {
            if (error.code != 404) throw error
            // Rolling-deployment fallback. The old password is still freshly
            // reauthenticated against the SAME Supabase Auth used by sign-in.
            // No service key, password caching or cross-account update.
            val session = get("/api/v1/auth/session", token)
            val account = session.optJSONObject("user")
                ?: throw ApiFailure(401, "Session unavailable")
            val accountId = account.optString("id")
            val email = account.optString("email")
            if (accountId.isBlank() || email.isBlank())
                throw ApiFailure(401, "Account identity unavailable")
            val config = get("/api/v1/mobile/config")
            val origin = config.str("supabaseUrl").trimEnd('/')
            val apiKey = config.str("supabaseAnonKey")
            require(origin.startsWith("https://") && apiKey.isNotBlank())
            val fresh = authRequest(origin, apiKey, "password",
                JSONObject().put("email", email).put("password", current))
            if (fresh.optJSONObject("user")?.optString("id") != accountId)
                throw ApiFailure(401, "Current password cannot be verified")
            val proof = fresh.str("access_token")
            require(proof.isNotBlank())
            withContext(Dispatchers.IO) {
                val request = Request.Builder().url(origin + "/auth/v1/user")
                    .header("apikey", apiKey)
                    .header("Authorization", "Bearer " + proof)
                    .put(JSONObject().put("password", next).toString()
                        .toRequestBody(jsonType))
                    .build()
                client.newCall(request).execute().use { reply ->
                    if (!reply.isSuccessful) {
                        throw ApiFailure(reply.code,
                            "Password update rejected by account provider")
                    }
                }
            }
            JSONObject().put("changed", true)
        }
    }

    suspend fun loginHistory88(token: String, page: Int = 1): JSONObject {
        require(page in 1..100)
        return get("/api/v1/account/login-history?page=" + page, token)
    }

    suspend fun recordLogin88(token: String): JSONObject =
        request("/api/v1/account/login-history", token, JSONObject(), "POST")

    suspend fun login(email: String, password: String): JSONObject {
        val config = get("/api/v1/mobile/config")
        if (!config.optBoolean("authenticationConfigured")) throw ApiFailure(503, "Sign in unavailable")
        val url = config.str("supabaseUrl").trimEnd('/')
        val key = config.str("supabaseAnonKey")
        require(url.startsWith("https://") && key.isNotBlank())
        return authRequest(url, key, "password", JSONObject().put("email", email).put("password", password))
    }

    suspend fun refresh(refreshToken: String): JSONObject {
        val config = get("/api/v1/mobile/config")
        val url = config.str("supabaseUrl").trimEnd('/')
        val key = config.str("supabaseAnonKey")
        require(url.startsWith("https://") && key.isNotBlank())
        return authRequest(url, key, "refresh_token", JSONObject().put("refresh_token", refreshToken))
    }

    private suspend fun authRequest(url: String, key: String, grant: String, body: JSONObject): JSONObject =
        withContext(Dispatchers.IO) {
            val request = Request.Builder().url(url + "/auth/v1/token?grant_type=" + grant)
                .header("apikey", key).header("Accept", "application/json")
                .post(body.toString().toRequestBody(jsonType)).build()
            client.newCall(request).execute().use { response ->
                val value = runCatching { JSONObject(response.body?.string().orEmpty()) }
                    .getOrDefault(JSONObject())
                if (!response.isSuccessful) throw ApiFailure(response.code,
                    value.str("msg", value.str("error_description", "Sign in failed")))
                if (value.str("access_token").isBlank()) throw ApiFailure(401, "No session returned")
                value
            }
        }

    /** Use Supabase Auth's own MFA API; no shared TOTP secrets on BetVima servers.
     * All endpoints require a valid user access token, never a service-role key.
     */
    private suspend fun mfaAuthCall(
        token: String, method: String, suffix: String, payload: JSONObject? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        require(token.isNotBlank())
        require(suffix.startsWith("/") && !suffix.contains(".."))
        val config = get("/api/v1/mobile/config")
        val url = config.str("supabaseUrl").trimEnd('/')
        val key = config.str("supabaseAnonKey")
        require(url.startsWith("https://") && key.isNotBlank())
        val builder = Request.Builder().url(url + "/auth/v1" + suffix)
            .header("apikey", key).header("Authorization", "Bearer " + token)
            .header("Accept", "application/json").header("Cache-Control", "no-store")
        when (method) {
            "POST" -> builder.post((payload ?: JSONObject()).toString().toRequestBody(jsonType))
            "DELETE" -> builder.delete()
            "GET" -> builder.get()
            else -> error("Unsupported MFA method")
        }
        client.newCall(builder.build()).execute().use { response ->
            val value = runCatching { JSONObject(response.body?.string().orEmpty()) }.getOrDefault(JSONObject())
            if (!response.isSuccessful) throw ApiFailure(response.code,
                value.str("msg", value.str("error_description", value.str("message", "Authenticator request failed"))))
            value
        }
    }

    suspend fun mfaUser(token: String): JSONObject = mfaAuthCall(token, "GET", "/user")

    suspend fun mfaAllTotpFactors(token: String): List<AuthenticatorFactor> =
        parseTotpFactors(mfaUser(token))

    suspend fun mfaFactors(token: String): List<String> =
        mfaAllTotpFactors(token).filter { it.verified }.map { it.id }

    /** Never use a friendly name to identify a factor being deleted. Delete only
     * a specific unverified factor ID returned by Supabase for this user.
     */
    suspend fun mfaEnroll(token: String, backup: Boolean = false): JSONObject {
        val name = if (backup) "BetVima Backup Authenticator" else "BetVima Authenticator"
        val factors = mfaAllTotpFactors(token)
        require(factors.none { it.verified && it.name == name }) {
            "This authenticator is already active"
        }
        factors.filter { !it.verified && it.name == name }
            .forEach { mfaUnenroll(token, it.id) }
        return mfaAuthCall(token, "POST", "/factors",
            JSONObject().put("factor_type", "totp").put("friendly_name", name))
    }

    suspend fun mfaChallengeVerify(token: String, factorId: String, code: String): JSONObject {
        require(Regex("[a-fA-F0-9-]{36}").matches(factorId))
        require(Regex("[0-9]{6}").matches(code))
        val challenge = mfaAuthCall(token, "POST", "/factors/$factorId/challenge")
        val challengeId = challenge.str("id").takeIf { it.isNotBlank() }
            ?: throw ApiFailure(503, "MFA challenge was not created")
        val verified = mfaAuthCall(token, "POST", "/factors/$factorId/verify",
            JSONObject().put("challenge_id", challengeId).put("code", code))
        if (verified.str("access_token").isBlank() || verified.str("refresh_token").isBlank())
            throw ApiFailure(401, "MFA did not issue an authenticated session")
        return verified
    }

    suspend fun mfaUnenroll(token: String, factorId: String) {
        require(Regex("[a-fA-F0-9-]{36}").matches(factorId))
        mfaAuthCall(token, "DELETE", "/factors/$factorId")
    }

    /** Casino games are fetched from BetVima, never directly from the provider. */
    suspend fun casinoGames(
        page: Int = 1, category: String = "", query: String = "", provider: String = ""
    ): CasinoPage {
        require(page in 1..1000)
        require(category.length <= 40 && query.length <= 80 && provider.length <= 80)
        val route = buildString {
            append("/api/v1/casino/games?page=")
            append(page)
            append("&limit=40")
            if (category.isNotEmpty()) append("&category=" + URLEncoder.encode(category, "UTF-8"))
            if (query.isNotBlank()) append("&q=" + URLEncoder.encode(query.trim(), "UTF-8"))
            if (provider.isNotEmpty()) append("&provider=" + URLEncoder.encode(provider, "UTF-8"))
        }
        // Retry transient connectivity/provider failures only. Never retry auth, disabled
        // casino (503 CASINO_DISABLED), or other deliberate availability gates.
        for (attempt in 0..2) {
            try {
                return parseCasinoPage(get(route))
            } catch (cancel: kotlinx.coroutines.CancellationException) {
                throw cancel
            } catch (failure: IOException) {
                val status = (failure as? ApiFailure)?.code
                val transient = status == null || status == 502 || status == 504 || status == 429
                if (!transient || attempt == 2) throw failure
                kotlinx.coroutines.delay(400L * (attempt + 1))
            }
        }
        error("Unreachable casino catalogue retry state")
    }

    /** Server verifies account, wallet currency and pilot-only real-money access. */
    suspend fun casinoEligibility(token: String): CasinoEligibility =
        parseCasinoEligibility(get("/api/v1/casino/eligibility", token))

    /** A provider launch URL is a short-lived session credential: never log or persist it. */
    suspend fun casinoLaunch(token: String, gameId: String, demo: Boolean = true,
        lang: String = "en"): String {
        require(lang == "en" || lang == "fa")
        require(gameId.isNotBlank() && gameId.length <= 200)
        // Server is the sole authority: allowlist, FX readiness and financial
        // feature gate are independently enforced for every real-money launch.
        val response = request(
            "/api/v1/casino/launch", token,
            JSONObject().put("gameId", gameId).put("demo", demo)
                .put("device", "mobile").put("lang", lang),
            // Both launch modes involve sequential provider session creation.
            // The dedicated client never retries these stateful requests.
            casinoDemo = true
        )
        val url = response.optString("url")
        val uri = android.net.Uri.parse(url)
        if (!url.startsWith("https://") || uri.scheme != "https" ||
            uri.host.isNullOrBlank() || uri.userInfo != null) {
            throw ApiFailure(502, "Provider returned an invalid launch URL")
        }
        return url
    }

    /** Read-only live and prematch odds for the probability diagram. */
    suspend fun slipProbabilityOdds(matchId: String): SlipOddsMatch {
        require(matchId.matches(Regex("[a-fA-F0-9-]{36}")))
        return parseSlipOddsMatch(get("/api/v1/matches/" + matchId + "/odds"))
    }

    // Only sports-data caching changes in version 0.112. No Compose, assets,
    // tabs, layouts, slips, wallets or authentication source files are changed.
    private val fixtureLock = Any()
    private val fixtureCache = LinkedHashMap<String, Match>()
    private val headlineCache = LinkedHashMap<String, Pair<Long, JSONObject>>()

    private fun remember(matches: List<Match>): List<Match> {
        synchronized(fixtureLock) {
            matches.forEach { fixtureCache[it.id] = it }
            while (fixtureCache.size > 900) fixtureCache.remove(fixtureCache.keys.first())
        }
        return matches
    }

    private suspend fun bet365List(mode: String, sport: String): List<Match> =
        remember(parseBet365Catalogue(get(bet365CataloguePath(mode, sport)))
            .map { it.copy(
                sport = if (it.sport == "ice-hockey") "hockey" else it.sport,
                bettingAvailable = false
            ) })

    private suspend fun bet365Prices(ref: Bet365Ref): JSONObject {
        val key = "${ref.mode}:${ref.sportId}:${ref.fi}"
        val cached = synchronized(fixtureLock) { headlineCache[key] }
        val now = System.currentTimeMillis()
        val expiryMs = if (ref.mode == "live") 25_000L else 90_000L
        if (cached != null && now - cached.first < expiryMs) return cached.second
        val result = get(bet365PricesPath(ref, headline = true))
        if (result.str("source") == BET365_SOURCE && result.str("error").isBlank()) {
            synchronized(fixtureLock) {
                headlineCache[key] = now to result
                while (headlineCache.size > 400)
                    headlineCache.remove(headlineCache.keys.first())
            }
        }
        return result
    }

    /** Keep the existing native Live rows and cards; switch only fixture source. */
    suspend fun live(): Pair<List<Match>, Boolean> {
        val sports = bet365LiveSports
        val lists = supervisorScope {
            sports.map { sport -> async {
                runCatching { bet365List("live", sport) }
            } }.awaitAll()
        }
        if (lists.all { it.isFailure })
            throw ApiFailure(503, "BetsAPI live fixtures unavailable")
        val distinct = lists.flatMap { it.getOrDefault(emptyList()) }.distinctBy { it.id }
        // A partial upstream failure plus zero fixtures is not proof that there
        // are zero live events. Surface it as a feed outage instead of a
        // misleading "No live matches" empty state.
        if (distinct.isEmpty() && lists.any { it.isFailure })
            throw ApiFailure(503, "BetsAPI live catalogue only returned failures/empty partials")
        // Preview prices can never become bets: all imported markets are suspended,
        // every fixture has bettingAvailable=false and liveEnabled is false.
        return enrichBet365Cards(distinct) to false
    }

    /** Top and sport-specific Upcoming use the same unchanged native cards. */
    suspend fun upcoming(sport: String = "all"): List<Match> {
        val keys = if (sport == "all") bet365PrimarySports
                   else listOf(betsApiSport(sport) ?: return emptyList())
        val lists = supervisorScope {
            keys.map { key -> async {
                runCatching { bet365List("upcoming", key) }
            } }.awaitAll()
        }
        if (lists.all { it.isFailure })
            throw ApiFailure(503, "BetsAPI upcoming fixtures unavailable")
        val matches = lists.flatMap { it.getOrDefault(emptyList()) }
            .distinctBy { it.id }.sortedBy { it.starts }
        if (matches.isEmpty() && lists.any { it.isFailure })
            throw ApiFailure(503, "BetsAPI upcoming catalogue only returned failures/empty partials")
        return enrichBet365Cards(matches)
    }

    /** Bound requests for headline previews: never fetch every visible fixture
     * at once and never inject BetsAPI ids into the wager-placement protocol.
     */
    private suspend fun enrichBet365Cards(matches: List<Match>): List<Match> {
        if (matches.isEmpty()) return matches
        // Retain the existing 12-request upper bound. Prioritise a balanced
        // sample: the six nearest fixtures and the highest provider-reported
        // market counts. The old "first 12 only" approach could miss every
        // high-variety fixture beyond page position 12, leaving Top Bets blank.
        val previewIndices = TopBetsRanking121.headlinePreviewIndices(matches)
        val headlines = supervisorScope {
            previewIndices.map { index -> async {
                val ref = bet365Ref(matches[index].id)
                if (ref == null) null else runCatching {
                    withContext(Dispatchers.IO) { bet365Prices(ref) }
                }.getOrNull()
            } }.awaitAll()
        }
        val headlinesByIndex = previewIndices.zip(headlines).toMap()
        val priced = matches.mapIndexed { index, match ->
            headlinesByIndex[index]?.let { withBet365Headline(match, it) } ?: match
        }
        return remember(priced)
    }

    /**
     * Search keeps native UI untouched. The server's /matches endpoint now
     * returns exclusively BetsAPI fixtures; reject any previous bookmaker feed.
     */
    suspend fun searchMatches(query: String, live: Boolean): List<Match> {
        val data = get(searchQueryPath(query, live))
        return remember(parseBet365Catalogue(
            JSONObject().put("source", data.str("source"))
                .put("error", data.str("error"))
                .put("matches", data.arr("items"))
        ).map { it.copy(
            sport = if (it.sport == "ice-hockey") "hockey" else it.sport,
            bettingAvailable = false
        ) })
    }

    /** Dedicated match statistics, deliberately separate from sportsbook odds. */
    suspend fun matchFacts(id: String): LiveMatchFacts? {
        val fixture = bet365Ref(id) ?: return null
        if (fixture.mode != "live") return null
        val response = get("/api/v1/betsapi/match-facts?section=stats&mode=live&sportId=" +
            fixture.sportId + "&fi=" + fixture.fi)
        return parseBet365LiveFacts(response).takeIf { it.fi == fixture.fi }
    }

    /** Bet365 FI has its own namespace. Read-only market details are obtained
     * through the site's provider proxy, NEVER the legacy local UUID endpoint.
     */
    suspend fun detail(id: String): Match {
        val ref = bet365Ref(id)
        if (ref != null) {
            val match = synchronized(fixtureLock) { fixtureCache[id] }
                ?: run {
                    val sport = when (ref.sportId) {
                        "1" -> "football"; "18" -> "basketball"; "13" -> "tennis"
                        "91" -> "volleyball"; "17" -> "ice-hockey"
                        "3" -> "cricket"; "78" -> "handball"; "16" -> "baseball"
                        "12" -> "american-football"; "92" -> "table-tennis"
                        else -> null
                    }
                    sport?.let { bet365List(ref.mode, it).firstOrNull { m -> m.id == id } }
                }
                ?: throw ApiFailure(404, "BetsAPI fixture unavailable")
            val response = get(bet365PricesPath(ref))
            val enriched = withBet365Details(match, response)
            // Bet365's filtered list may omit timer.tm even for a real live
            // match. The event facts endpoint reads TM/TT/TS/TU, capped to a
            // small best-effort timeout. No visual component is modified.
            val freshFacts = if (ref.mode == "live" && ref.sportId == "1") {
                withTimeoutOrNull(4_000L) {
                    runCatching {
                        get("/api/v1/betsapi/match-facts?section=stats&mode=live&sportId=1&fi=" + ref.fi)
                    }.getOrNull()
                }
            } else null
            val current = withBet365MatchMinute(enriched, freshFacts)
            remember(listOf(current))
            return current
        }
        // Retain account access to historical bets identified by internal UUID.
        require(id.matches(Regex("[a-fA-F0-9-]{36}")))
        val data = get("/api/v1/matches/" + id)
        val match = data.optJSONObject("match") ?: throw ApiFailure(404, "Match unavailable")
        return parseMatch(match, data.optJSONArray("markets"))
    }
    internal fun parseBetLeg(leg: JSONObject): BetLegDetail {
        val match = leg.optJSONObject("match")
        fun integerOrNull(key: String) = match?.takeIf { !it.isNull(key) && it.has(key) }?.optInt(key)
        return BetLegDetail(
            matchLabel = leg.str("matchLabel"), marketLabel = leg.str("marketLabel"),
            selectionLabel = leg.str("selectionLabel"),
            // Prefer the odds explicitly accepted by the customer if the
            // placement snapshot includes a price movement. Never use live odds.
            oddsScaled = leg.str("acceptedOddsScaled").takeIf {
                it.toBigDecimalOrNull()?.signum() == 1
            } ?: leg.str("oddsAtPlacementScaled", "0"),
            status = leg.str("status"), result = leg.str("grade"),
            league = match?.str("leagueName").orEmpty(), matchId = leg.str("matchId"),
            matchStatus = match?.str("status").orEmpty(),
            scheduledAt = match?.str("scheduledAt").orEmpty(),
            minute = integerOrNull("minute"), clock = match?.str("clock").orEmpty(),
            period = match?.str("period").orEmpty(),
            homeScore = integerOrNull("homeScore"), awayScore = integerOrNull("awayScore"),
            homeTeamName = match?.str("homeTeamName").orEmpty(),
            awayTeamName = match?.str("awayTeamName").orEmpty(),
            homeTeamLogoUrl = match?.str("homeTeamLogoUrl").orEmpty(),
            awayTeamLogoUrl = match?.str("awayTeamLogoUrl").orEmpty()
        )
    }

    suspend fun bets(token: String, page: Int = 1): BetPage =
        betHistory(token, BetHistoryQuery(), page)

    suspend fun betHistory(token: String, filter: BetHistoryQuery, page: Int = 1): BetPage {
        val response = get(betHistoryPath(filter, page), token)
        val items = response.arr("items").objects().map {
            Bet(
                id = it.str("id"),
                status = it.str("status"),
                type = it.str("type"),
                stakeMinor = it.str("stakeMinor", "0"),
                payoutMinor = it.str("potentialPayoutMinor", "0"),
                currency = it.str("currency", "USD"),
                legs = it.arr("legs").length(),
                settledPayoutMinor = it.str("settledPayoutMinor").takeIf(String::isNotBlank),
                netResultMinor = it.str("netResultMinor").takeIf(String::isNotBlank),
                placedAt = it.str("placedAt", it.str("createdAt")),
                combinedOddsScaled = it.str("combinedOddsScaled", "0"),
                selections = it.arr("legs").objects().map(::parseBetLeg)
            )
        }
        return BetPage(items, response.optInt("page", page), response.optBoolean("hasMore", false))
    }
    suspend fun betDetail(token: String, id: String): BetDetail {
        require(id.matches(Regex("[A-Za-z0-9-]{1,100}")))
        val data = get("/api/v1/bets/" + id, token)
        val bet = data.optJSONObject("bet") ?: throw ApiFailure(404, "Bet not found")
        return BetDetail(
            id = bet.str("id"), publicId = bet.str("publicId", bet.str("id")),
            status = bet.str("status"), currency = bet.str("currency", "USD"),
            stakeMinor = bet.str("stakeMinor", "0"),
            potentialPayoutMinor = bet.str("potentialPayoutMinor", "0"),
            settledPayoutMinor = bet.str("settledPayoutMinor").takeIf(String::isNotBlank),
            netResultMinor = bet.str("netResultMinor").takeIf(String::isNotBlank),
            placedAt = bet.str("placedAt"),
            settledAt = bet.str("settledAt").takeIf(String::isNotBlank),
            legs = bet.arr("legs").objects().map(::parseBetLeg)
        )
    }
    suspend fun wallet(token: String, page: Int = 1): Wallet {
        require(page in 1..1000)
        // Omit currency: the first-party API uses the user's canonical account currency.
        val data = get("/api/v1/wallet?page=" + page, token)
        val w = data.optJSONObject("wallet") ?: JSONObject()
        val tx = data.optJSONObject("transactions") ?: JSONObject()
        // Payment intents are denominated in provider currency. For an IRR/IRT
        // account, crypto deposits and voucher payouts can be USD intents.
        // Read the USD *payment rows* separately, without mixing wallet
        // balances/ledger entries denominated in different currencies.
        val companionUsd = if (page == 1 && w.str("currency") in setOf("IRR", "IRT"))
            runCatching { get("/api/v1/wallet?currency=USD&page=1", token) }.getOrNull()
        else null
        val paymentRows = (data.optJSONObject("payments")?.arr("items")?.objects().orEmpty() +
            companionUsd?.optJSONObject("payments")?.arr("items")?.objects().orEmpty())
            .distinctBy { it.str("publicId", it.str("id")) }
            .sortedByDescending { it.str("createdAt") }
        return Wallet(w.str("availableMinor", "0"), w.str("balanceMinor", "0"),
            w.str("heldMinor", "0"), w.str("currency", "USD"),
            data.str("integrity", "unknown"), tx.arr("items").objects().map {
                Transaction(it.str("id"), it.str("type", "transaction"),
                    it.str("amountMinor", "0"), it.str("createdAt"),
                    it.str("direction"), it.str("status"))
            }, tx.optInt("page", page), tx.optBoolean("hasMore", false),
            paymentRows.map {
                WalletPaymentRecord(
                    id = it.str("id"), publicId = it.str("publicId"),
                    direction = it.str("direction"), status = it.str("status"),
                    amountMinor = it.str("amountMinor", "0"), currency = it.str("currency"),
                    createdAt = it.str("createdAt"), failureMessage = it.str("failureMessage")
                )
            })
    }

    suspend fun walletMethods(direction: String, currency: String): WalletMethodCatalogue {
        require(direction in listOf("deposit", "withdrawal"))
        require(currency in setOf("USD", "IRR", "IRT"))
        return parseWalletMethods(get(
            "/api/v1/payments/methods?direction=" + direction + "&currency=" + currency))
    }
    suspend fun walletVoucherQuote(token: String): WalletExchangeQuote {
        val o = get("/api/v1/fx/uwallet-voucher", token)
        return WalletExchangeQuote(o.str("rateIrrPerUsd"), o.str("quotedAt"), o.str("signature"))
    }
    suspend fun walletUsdIrrRate(token: String): String =
        get("/api/v1/fx/usd-irr", token).str("value")

    /** Caller creates one UUID per explicit confirmation, never replay a financial POST. */
    suspend fun createWalletDeposit(token: String, payload: JSONObject, requestId: String): WalletPaymentIntent =
        parseWalletIntent(request("/api/v1/wallet/deposit", token, payload, "POST", requestId))
    suspend fun createWalletWithdrawal(token: String, payload: JSONObject, requestId: String): WalletPaymentIntent =
        parseWalletIntent(request("/api/v1/wallet/withdraw", token, payload, "POST", requestId))
    suspend fun voucherPaymentStatus(token: String, publicId: String): WalletPaymentIntent =
        parseWalletIntent(get("/api/v1/wallet/deposit/voucher/status?publicId=" +
            URLEncoder.encode(publicId, "UTF-8"), token))

    /** Campaign and personal grants come from the same authenticated API as the website. */
    suspend fun bonusCurrencyPage(token: String, currency: String, page: Int = 1): BonusCurrencyPage {
        require(currency in setOf("USD", "IRR", "IRT"))
        require(page in 1..1000)
        val data = get("/api/v1/bonuses?currency=" + currency + "&page=" + page +
            "&pageSize=100", token)
        return parseBonusCurrencyPage(data, currency, page)
    }

    /** Exact active-grant query used by the website's Bonus Account selector. */
    suspend fun availableBonusGrants(token: String, currency: String): List<BonusReward> {
        require(currency in setOf("USD", "IRR", "IRT"))
        val data = get("/api/v1/bonuses?currency=" + currency +
            "&status=active&pageSize=100", token)
        return parseBonusCurrencyPage(data,currency,1).items.filter {
            it.currency == currency && it.status == "active" &&
                (it.remainingMinor.toLongOrNull() ?: 0L) > 0
        }
    }

    /** Legacy account header uses the account's currency, not hardcoded USD. */
    suspend fun bonuses(token: String): List<Bonus> =
        get("/api/v1/bonuses", token).arr("items").objects().map {
            Bonus(it.str("title", "Deposit bonus"), it.str("status"),
                it.str("remainingAmountMinor", "0"), it.str("currency", "USD"))
        }

    suspend fun notifications(token: String, page: Int = 1): NotificationPage {
        require(page in 1..1000)
        val data = get("/api/v1/notifications?pageSize=20&page=" + page, token)
        return NotificationPage(
            items = data.arr("items").objects().map { notification ->
                val meta = notification.optJSONObject("data")
                UserNotification(
                    id = notification.str("id"),
                    eventKey = notification.str("eventKey"),
                    title = notification.str("title"),
                    body = notification.str("body"),
                    createdAt = notification.str("createdAt"),
                    readAt = notification.str("readAt").takeIf(String::isNotBlank),
                    audience = if (meta?.str("audience") == "general") "general" else "personal",
                    ctaLabel = meta?.str("ctaLabel")?.trim()?.takeIf(String::isNotEmpty),
                    ctaHref = meta?.str("ctaHref")?.trim()?.takeIf(String::isNotEmpty)
                )
            },
            page = data.optInt("page", page),
            hasMore = data.optBoolean("hasMore", false),
            unreadCount = data.optInt("unreadCount", 0).coerceAtLeast(0)
        )
    }
    suspend fun readNotifications(token: String, ids: List<String> = emptyList(), all: Boolean = false): Int {
        require(all || ids.isNotEmpty())
        val data = post("/api/v1/notifications",
            JSONObject().put("all", all).put("ids", JSONArray(ids)), token)
        return data.optInt("updated", 0)
    }
    /** Public first-party code. No user identity or stake is embedded. */
    suspend fun createBetSlipShare(picks: List<Pick>, currency: String): String {
        val result = request("/api/v1/betslip/share",body=shareSlipPayload(picks,currency))
        return result.str("code").also {
            if (!validBetSlipCode(it)) throw ApiFailure(502,"Invalid code returned by server")
        }
    }

    /** Retrieve only current available server-side selections, never trust old odds. */
    suspend fun loadBetSlipShare(code: String): ImportedSlip {
        val normalized = normalizeBetSlipCode(code)
        require(validBetSlipCode(normalized))
        val result = get("/api/v1/betslip/share/" + normalized)
        return parseImportedSlip(result)
    }

    suspend fun quote(token: String, picks: List<Pick>, stakeMinor: String,
        currency: String = "USD"): JSONObject {
        require(currency in setOf("USD", "IRR", "IRT"))
        val legs = JSONArray()
        picks.forEach {
            legs.put(JSONObject().put("matchId", it.matchId).put("marketId", it.marketId)
                .put("selectionId", it.selectionId).put("clientOddsScaled", it.oddsScaled)
                .put("marketVersion", it.version ?: JSONObject.NULL).put("acceptOddsChange", false))
        }
        return post("/api/v1/bets/quote", JSONObject()
            .put("type", if (picks.size > 1) "MULTIPLE" else "SINGLE")
            .put("stakeMinor", stakeMinor).put("currency", currency).put("legs", legs), token)
    }
    /**
     * Money-mutating main-account wager, accepted only with a live server-signed
     * quote and an idempotency key. Never automatically replay this POST.
     */
    suspend fun placeMainBet(
        token: String, picks: List<Pick>, stakeMinor: String, currency: String,
        quoteToken: String, acceptedOdds: Map<String, String>, requestId: String
    ): JSONObject {
        // Re-read the live operator switches before *every* financial POST.
        // This is an additional client guard: the server still decides per-user
        // eligibility, limits, location, risk, quoted odds and atomic debit.
        // A failed preflight occurs before any financial POST. Never mark it
        // as an uncertain debit simply because the connectivity check failed.
        if (!runCatching { wageringAvailable() }.getOrDefault(false)) {
            throw ApiFailure(403, "Wagering is unavailable or blocked by the server",
                serverCode = "WAGERING_DISABLED")
        }
        require(picks.isNotEmpty() && picks.size <= 20)
        require(picks.map { it.matchId }.distinct().size == picks.size)
        require(stakeMinor.matches(Regex("[0-9]{1,19}")) && stakeMinor != "0")
        require(currency in setOf("USD", "IRR", "IRT"))
        require(quoteToken.length >= 10 && requestId.isNotBlank())
        val legs = JSONArray().also { entries ->
            picks.forEach { pick ->
                entries.put(JSONObject()
                    .put("matchId", pick.matchId).put("marketId", pick.marketId)
                    .put("selectionId", pick.selectionId)
                    .put("clientOddsScaled", pick.oddsScaled)
                    .put("marketVersion", pick.version ?: JSONObject.NULL)
                    .put("acceptOddsChange", false))
            }
        }
        val accepted = JSONObject()
        acceptedOdds.forEach { (selectionId, scaled) -> accepted.put(selectionId, scaled) }
        return request("/api/v1/bets", token, JSONObject()
            .put("type", if (picks.size > 1) "MULTIPLE" else "SINGLE")
            .put("stakeMinor", stakeMinor)
            .put("currency", currency)
            .put("fundingSource", "main")
            .put("legs", legs)
            .put("quoteToken", quoteToken)
            .put("acceptedOdds", accepted)
            .put("acceptWarnings", true),
            "POST", requestId)
    }

    private fun bonusBetLegs(picks: List<Pick>, movements: List<BonusOddsMovement> =
        emptyList()): JSONArray {
        val changes = movements.associateBy { it.selectionId }
        return JSONArray().also { legs ->
            picks.forEach { pick ->
                val update = changes[pick.selectionId]
                legs.put(JSONObject()
                    .put("matchId", pick.matchId)
                    .put("marketId", pick.marketId)
                    .put("selectionId", pick.selectionId)
                    .put("clientOddsScaled", update?.currentScaled ?: pick.oddsScaled)
                    .put("marketVersion", update?.version ?: pick.version ?: JSONObject.NULL)
                    .put("acceptOddsChange", update != null))
            }
        }
    }

    /** Server-signed quote; fetching it does not place a bet or change balances. */
    suspend fun bonusBetQuote(
        token: String, picks: List<Pick>, bonus: BonusReward
    ): BonusPlacementQuote {
        require(picks.size == 4 && bonus.currency in setOf("USD", "IRR", "IRT"))
        val data = post("/api/v1/bets/quote", JSONObject()
            .put("type", "MULTIPLE")
            .put("currency", bonus.currency)
            .put("stakeMinor", bonus.remainingMinor)
            .put("legs", bonusBetLegs(picks)), token)
        val quote = data.optJSONObject("quote") ?: throw ApiFailure(502,"Quote missing")
        return parseBonusPlacementQuote(quote, bonus.currency)
    }

    /**
     * Real wager. Called only from explicit user confirmation and never
     * automatically retried. The signed quote and SQL bonus-grant lock are
     * authoritative; client checks are only additional safeguards.
     */
    suspend fun placeBonusBet(
        token: String, picks: List<Pick>, bonus: BonusReward,
        quote: BonusPlacementQuote, requestId: String
    ): JSONObject {
        require(requestId.isNotBlank() && picks.size == 4)
        require(quote.currency == bonus.currency && quote.stakeMinor == bonus.remainingMinor)
        require(validateBonusQuote(quote,picks,bonus,System.currentTimeMillis()) == null)
        val accepted = JSONObject()
        quote.movements.forEach { accepted.put(it.selectionId,it.currentScaled) }
        return request("/api/v1/bets", token, JSONObject()
            .put("type", "MULTIPLE")
            .put("stakeMinor", bonus.remainingMinor)
            .put("currency", bonus.currency)
            .put("fundingSource", "bonus")
            .put("bonusGrantId", bonus.id)
            .put("legs", bonusBetLegs(picks,quote.movements))
            .put("quoteToken",quote.quoteToken)
            .put("acceptedOdds",accepted)
            .put("acceptWarnings",true),
            "POST",requestId)
    }

    private fun parseSupportTicket(t: JSONObject): SupportTicket = SupportTicket(
        id = t.str("id"), subject = t.str("subject"),
        status = t.str("status"), category = t.str("category"),
        createdAt = t.str("createdAt"), updatedAt = t.str("updatedAt"),
        lastMessageAt = t.str("lastMessageAt"), priority = t.str("priority", "normal"),
        unreadMessages = t.optInt("unreadMessages", 0)
    )

    suspend fun supportTickets(token: String, page: Int = 1): SupportTicketPage {
        require(page in 1..10000)
        val data = get("/api/v1/support?pageSize=25&page=" + page, token)
        val block = data.optJSONObject("tickets") ?: JSONObject()
        val items = block.arr("items").objects().map(::parseSupportTicket)
        return SupportTicketPage(
            items, block.optInt("page", page), block.optInt("total", items.size),
            block.optBoolean("hasMore", false)
        )
    }
    suspend fun tickets(token: String): List<SupportTicket> = supportTickets(token).items

    suspend fun createTicket(token: String, category: String, subject: String, body: String): SupportTicket {
        require(category in listOf("general","deposit","withdrawal","bet","login","bonus","technical","other"))
        require(subject.trim().length in 3..160 && body.trim().length in 1..5000)
        val data = post("/api/v1/support", JSONObject()
            .put("category", category).put("subject", subject.trim())
            .put("body", body.trim()), token)
        val t = data.optJSONObject("ticket") ?: throw ApiFailure(502, "Ticket not returned")
        return parseSupportTicket(t)
    }
    private fun supportAttachmentDetails(m: JSONObject): List<SupportAttachment> =
        m.arr("attachments").objects().mapNotNull { item ->
            val id = item.str("id")
            val name = item.str("originalName")
            if (id.isBlank() || name.isBlank()) null
            else SupportAttachment(
                id = id, originalName = name, mimeType = item.str("mimeType"),
                sizeBytes = item.optLong("sizeBytes", 0L)
            )
        }

    suspend fun supportConversation(token: String, ticketId: String): SupportConversation {
        require(Regex("[a-fA-F0-9-]{36}").matches(ticketId))
        val data = get("/api/v1/support/" + ticketId, token)
        val ticket = data.optJSONObject("ticket") ?: throw ApiFailure(502, "Ticket unavailable")
        val messages = data.arr("messages").objects().map {
            SupportThreadMessage(
                id = it.str("id"), body = it.str("body"),
                senderRole = it.str("senderRole"), createdAt = it.str("createdAt"),
                attachments = it.arr("attachments").objects()
                    .map { a -> a.str("originalName") }.filter(String::isNotBlank),
                attachmentDetails = supportAttachmentDetails(it)
            )
        }
        return SupportConversation(parseSupportTicket(ticket), messages)
    }
    private fun parseSupportMessage(m: JSONObject): SupportThreadMessage =
        SupportThreadMessage(
            id = m.str("id"), body = m.str("body"),
            senderRole = m.str("senderRole"), createdAt = m.str("createdAt"),
            attachments = m.arr("attachments").objects()
                .map { it.str("originalName") }.filter(String::isNotBlank),
            attachmentDetails = supportAttachmentDetails(m)
        )

    suspend fun sendSupportMessage(token: String, ticketId: String, text: String): SupportThreadMessage {
        require(Regex("[a-fA-F0-9-]{36}").matches(ticketId))
        require(text.trim().length in 1..5000)
        val data = post("/api/v1/support/" + ticketId + "/messages",
            JSONObject().put("body", text.trim()), token)
        val m = data.optJSONObject("message") ?: throw ApiFailure(502, "Message status unknown")
        return parseSupportMessage(m)
    }

    /**
     * The website uses multipart/form-data, with an optional message and a
     * real file part. Only SAF-granted documents are read; max 10 MB enforced
     * while streaming into a bounded local byte buffer before HTTP upload.
     */
    suspend fun sendSupportFile(
        token: String, ticketId: String, text: String,
        resolver: ContentResolver, uri: Uri, fileName: String,
        mimeType: String
    ): SupportThreadMessage = withContext(Dispatchers.IO) {
        require(Regex("[a-fA-F0-9-]{36}").matches(ticketId))
        require(text.trim().length <= 5000)
        require(mimeType in supportAttachmentMimeTypes) { "Unsupported file type" }
        val bytes = ByteArrayOutputStream()
        (resolver.openInputStream(uri) ?: throw IOException("Could not read selected document"))
            .use { input ->
                val chunk = ByteArray(16 * 1024)
                var total = 0L
                while (true) {
                    val count = input.read(chunk)
                    if (count < 0) break
                    total += count.toLong()
                    if (total > SUPPORT_MAX_FILE_BYTES)
                        throw IOException("File exceeds 10 MB limit")
                    bytes.write(chunk, 0, count)
                }
                require(total > 0) { "The selected file is empty" }
            }
        // The Android document provider's declared MIME may differ from the
        // actual content (including renamed photos). The server checks magic
        // bytes, so normalize only among explicitly allowed real file types.
        var uploadBytes = bytes.toByteArray()
        var actualMime = detectSupportMime(uploadBytes)
            ?: throw ApiFailure(415, "Unsupported image or document format")
        require(actualMime in supportAttachmentMimeTypes)
        if (supportRequiresPhotoOptimization(actualMime, uploadBytes.size)) {
            // A 10 MiB image can be accepted by Storage yet rejected by the
            // ingress proxy's 8 MiB generic body cap. Optimize photo copies
            // locally to <6 MiB while keeping sufficient document readability.
            val info = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(uploadBytes, 0, uploadBytes.size, info)
            if (info.outWidth < 1 || info.outHeight < 1)
                throw ApiFailure(415, "Image cannot be decoded")
            val opts = BitmapFactory.Options().apply { inSampleSize = 1 }
            while (maxOf(info.outWidth, info.outHeight) / opts.inSampleSize > 3200)
                opts.inSampleSize *= 2
            val bitmap = BitmapFactory.decodeByteArray(uploadBytes, 0, uploadBytes.size, opts)
                ?: throw ApiFailure(415, "Image cannot be decoded")
            try {
                if (actualMime != "image/jpeg" && bitmap.hasAlpha()) {
                    throw ApiFailure(413,
                        "This large transparent image needs a smaller export.")
                }
                val out = ByteArrayOutputStream()
                var fitted = false
                for (quality in listOf(91, 86, 80, 74, 66, 58)) {
                    out.reset()
                    val encoded = bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
                    if (encoded && out.size() in 1..SUPPORT_INGRESS_SAFE_BYTES) {
                        fitted = true
                        break
                    }
                }
                if (!fitted) throw ApiFailure(413,
                    "Image cannot be fitted within the upload gateway limit.")
                uploadBytes = out.toByteArray()
                actualMime = "image/jpeg"
            } finally {
                bitmap.recycle()
            }
        }
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("body", text.trim())
            .addFormDataPart(
                "file", supportCanonicalUploadFilename(fileName, actualMime),
                uploadBytes.toRequestBody(actualMime.toMediaType())
            )
            .build()
        val req = Request.Builder()
            .url(base + "/api/v1/support/" + ticketId + "/messages")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-store")
            .header("Authorization", "Bearer " + token)
            .post(body).build()
        val data = supportUploadClient.newCall(req).execute().use(::apiJson)
        parseSupportMessage(
            data.optJSONObject("message") ?: throw ApiFailure(502, "Message status unknown")
        )
    }

    /** Close matches the website: POST with no JSON payload. */
    suspend fun closeSupportTicket(token: String, ticketId: String): SupportTicket {
        require(Regex("[a-fA-F0-9-]{36}").matches(ticketId))
        val data = request("/api/v1/support/" + ticketId + "/close",
            token = token, emptyPost = true)
        return parseSupportTicket(data.optJSONObject("ticket") ?: throw ApiFailure(502, "Ticket unavailable"))
    }

}
