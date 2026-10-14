package com.betvima.app.data

import com.betvima.app.BuildConfig
import kotlinx.coroutines.Dispatchers
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

class ApiFailure(val code: Int, override val message: String) : IOException(message)

/** HTTPS-only read interface to BetVima. Never logs credentials or wallet contents. */
class ApiClient {
    private val client = OkHttpClient.Builder().connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS).callTimeout(20, TimeUnit.SECONDS).build()
    private val base = BuildConfig.API_BASE_URL.trimEnd('/')
    private val jsonType = "application/json".toMediaType()

    suspend fun get(path: String, token: String? = null): JSONObject = request(path, token)
    suspend fun post(path: String, value: JSONObject, token: String): JSONObject =
        request(path, token, value)
    suspend fun patch(path: String, value: JSONObject, token: String): JSONObject =
        request(path, token, value, "PATCH")

    private suspend fun request(path: String, token: String? = null, body: JSONObject? = null, verb: String = "POST"): JSONObject =
        withContext(Dispatchers.IO) {
            require(path.startsWith("/api/v1/"))
            val builder = Request.Builder().url(base + path)
                .header("Accept", "application/json").header("Cache-Control", "no-store")
            if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer " + token)
            if (body != null) builder.method(verb, body.toString().toRequestBody(jsonType))
            client.newCall(builder.build()).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val wrapper = runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
                if (!response.isSuccessful || !wrapper.optBoolean("ok", false)) {
                    throw ApiFailure(response.code,
                        wrapper.optJSONObject("error")?.optString("message").orEmpty()
                            .ifBlank { "Request failed: " + response.code })
                }
                wrapper.optJSONObject("data") ?: wrapper
            }
        }

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

    suspend fun live(): Pair<List<Match>, Boolean> {
        val data = get("/api/v1/live?limit=100")
        return data.arr("matches").objects().map(::parseMatch) to
            (data.optBoolean("liveBettingEnabled") && !data.optBoolean("catalogueUnavailable"))
    }
    suspend fun upcoming(sport: String = "all"): List<Match> =
        get(upcomingQueryPath(sport)).arr("items").objects().map(::parseMatch)

    suspend fun detail(id: String): Match {
        require(id.matches(Regex("[A-Za-z0-9-]{1,100}")))
        val data = get("/api/v1/matches/" + id)
        val match = data.optJSONObject("match") ?: throw ApiFailure(404, "Match unavailable")
        return parseMatch(match, data.optJSONArray("markets"))
    }
    suspend fun bets(token: String, page: Int = 1): BetPage {
        require(page in 1..1000)
        val response = get("/api/v1/bets?pageSize=30&page=" + page, token)
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
                combinedOddsScaled = it.str("combinedOddsScaled", "0")
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
            legs = bet.arr("legs").objects().map { leg ->
                BetLegDetail(
                    matchLabel = leg.str("matchLabel"),
                    marketLabel = leg.str("marketLabel"),
                    selectionLabel = leg.str("selectionLabel"),
                    oddsScaled = leg.str("oddsAtPlacementScaled", "0"),
                    status = leg.str("status"), league =
                        leg.optJSONObject("match")?.str("leagueName").orEmpty(),
                    result = leg.str("grade")
                )
            }
        )
    }
    suspend fun wallet(token: String, page: Int = 1): Wallet {
        require(page in 1..1000)
        val data = get("/api/v1/wallet?currency=USD&page=" + page, token)
        val w = data.optJSONObject("wallet") ?: JSONObject()
        val tx = data.optJSONObject("transactions") ?: JSONObject()
        return Wallet(w.str("availableMinor", "0"), w.str("balanceMinor", "0"),
            w.str("heldMinor", "0"), w.str("currency", "USD"),
            data.str("integrity", "unknown"), tx.arr("items").objects().map {
                Transaction(it.str("id"), it.str("type", "transaction"),
                    it.str("amountMinor", "0"), it.str("createdAt"),
                    it.str("direction"), it.str("status"))
            }, tx.optInt("page", page), tx.optBoolean("hasMore", false))
    }
    suspend fun bonuses(token: String): List<Bonus> =
        get("/api/v1/bonuses?currency=USD", token).arr("items").objects().map {
            Bonus(it.str("title", "Deposit bonus"), it.str("status"),
                it.str("remainingAmountMinor", "0"), it.str("currency", "USD"))
        }

    suspend fun notifications(token: String, page: Int = 1): NotificationPage {
        require(page in 1..1000)
        val data = get("/api/v1/notifications?pageSize=20&page=" + page, token)
        return NotificationPage(data.arr("items").objects().map {
            UserNotification(it.str("id"), it.str("eventKey"),
                it.str("title"), it.str("body"), it.str("createdAt"),
                it.str("readAt").takeIf(String::isNotBlank))
        }, data.optInt("page", page), data.optBoolean("hasMore", false))
    }
    suspend fun readNotifications(token: String, ids: List<String> = emptyList(), all: Boolean = false): Int {
        require(all || ids.isNotEmpty())
        val data = post("/api/v1/notifications",
            JSONObject().put("all", all).put("ids", JSONArray(ids)), token)
        return data.optInt("updated", 0)
    }
    suspend fun quote(token: String, picks: List<Pick>, stakeMinor: String): JSONObject {
        val legs = JSONArray()
        picks.forEach {
            legs.put(JSONObject().put("matchId", it.matchId).put("marketId", it.marketId)
                .put("selectionId", it.selectionId).put("clientOddsScaled", it.oddsScaled)
                .put("marketVersion", it.version ?: JSONObject.NULL).put("acceptOddsChange", false))
        }
        return post("/api/v1/bets/quote", JSONObject()
            .put("type", if (picks.size > 1) "MULTIPLE" else "SINGLE")
            .put("stakeMinor", stakeMinor).put("currency", "USD").put("legs", legs), token)
    }
    suspend fun tickets(token: String): List<SupportTicket> {
        val data = get("/api/v1/support?pageSize=25", token)
        val collection = data.optJSONObject("tickets") ?: JSONObject()
        val list = collection.optJSONArray("items") ?: data.optJSONArray("tickets") ?: JSONArray()
        return list.objects().map {
            SupportTicket(it.str("id"), it.str("subject"), it.str("status"), it.str("category"))
        }
    }
    suspend fun createTicket(token: String, category: String, subject: String, body: String): SupportTicket {
        val data = post("/api/v1/support", JSONObject()
            .put("category", category).put("subject", subject).put("body", body), token)
        val t = data.optJSONObject("ticket") ?: throw ApiFailure(502, "Ticket not returned")
        return SupportTicket(t.str("id"), t.str("subject"), t.str("status"), t.str("category"))
    }

}
