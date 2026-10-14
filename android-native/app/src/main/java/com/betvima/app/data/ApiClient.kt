package com.betvima.app.data

import com.betvima.app.BuildConfig
import android.content.ContentResolver
import android.net.Uri
import okhttp3.MultipartBody
import okhttp3.Response
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
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
    private val base = BuildConfig.API_BASE_URL.trimEnd('/')
    private val jsonType = "application/json".toMediaType()

    suspend fun get(path: String, token: String? = null): JSONObject = request(path, token)
    /** Registration requires a Cloudflare-verified public API call, never a bearer session. */
    suspend fun registerAccount(payload: JSONObject): JSONObject =
        request("/api/v1/auth/register", body = payload)

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
            throw ApiFailure(response.code,
                wrapper.optJSONObject("error")?.optString("message").orEmpty()
                    .ifBlank { "Request failed: " + response.code })
        }
        return wrapper.optJSONObject("data") ?: wrapper
    }

    private suspend fun request(path: String, token: String? = null, body: JSONObject? = null,
        verb: String = "POST", idempotencyKey: String? = null,
        emptyPost: Boolean = false): JSONObject =
        withContext(Dispatchers.IO) {
            require(path.startsWith("/api/v1/"))
            val builder = Request.Builder().url(base + path)
                .header("Accept", "application/json").header("Cache-Control", "no-store")
            if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer " + token)
            if (idempotencyKey != null) builder.header("Idempotency-Key", idempotencyKey)
            if (body != null) builder.method(verb, body.toString().toRequestBody(jsonType))
            else if (emptyPost) builder.post(ByteArray(0).toRequestBody(null))
            (if (idempotencyKey == null && !emptyPost) client else financialClient)
                .newCall(builder.build()).execute().use(::apiJson)
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

    /**
     * Backend catalogue search (not just the first page already present in the UI).
     * q is URI-encoded, bound to the existing read-only /matches endpoint.
     */
    suspend fun searchMatches(query: String, live: Boolean): List<Match> {
        return get(searchQueryPath(query, live)).arr("items").objects().map(::parseMatch)
    }

    suspend fun detail(id: String): Match {
        require(id.matches(Regex("[A-Za-z0-9-]{1,100}")))
        val data = get("/api/v1/matches/" + id)
        val match = data.optJSONObject("match") ?: throw ApiFailure(404, "Match unavailable")
        return parseMatch(match, data.optJSONArray("markets"))
    }
    private fun parseBetLeg(leg: JSONObject): BetLegDetail {
        val match = leg.optJSONObject("match")
        fun integerOrNull(key: String) = match?.takeIf { !it.isNull(key) && it.has(key) }?.optInt(key)
        return BetLegDetail(
            matchLabel = leg.str("matchLabel"), marketLabel = leg.str("marketLabel"),
            selectionLabel = leg.str("selectionLabel"),
            oddsScaled = leg.str("oddsAtPlacementScaled", "0"),
            status = leg.str("status"), result = leg.str("grade"),
            league = match?.str("leagueName").orEmpty(), matchId = leg.str("matchId"),
            matchStatus = match?.str("status").orEmpty(),
            scheduledAt = match?.str("scheduledAt").orEmpty(),
            minute = integerOrNull("minute"), clock = match?.str("clock").orEmpty(),
            period = match?.str("period").orEmpty(),
            homeScore = integerOrNull("homeScore"), awayScore = integerOrNull("awayScore")
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
    suspend fun supportConversation(token: String, ticketId: String): SupportConversation {
        require(Regex("[a-fA-F0-9-]{36}").matches(ticketId))
        val data = get("/api/v1/support/" + ticketId, token)
        val ticket = data.optJSONObject("ticket") ?: throw ApiFailure(502, "Ticket unavailable")
        val messages = data.arr("messages").objects().map {
            SupportThreadMessage(
                id = it.str("id"), body = it.str("body"),
                senderRole = it.str("senderRole"), createdAt = it.str("createdAt"),
                attachments = it.arr("attachments").objects()
                    .map { a -> a.str("originalName") }.filter(String::isNotBlank)
            )
        }
        return SupportConversation(parseSupportTicket(ticket), messages)
    }
    private fun parseSupportMessage(m: JSONObject): SupportThreadMessage =
        SupportThreadMessage(
            id = m.str("id"), body = m.str("body"),
            senderRole = m.str("senderRole"), createdAt = m.str("createdAt"),
            attachments = m.arr("attachments").objects()
                .map { it.str("originalName") }.filter(String::isNotBlank)
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
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("body", text.trim())
            .addFormDataPart(
                "file", supportSafeFilename(fileName),
                bytes.toByteArray().toRequestBody(mimeType.toMediaType())
            )
            .build()
        val req = Request.Builder()
            .url(base + "/api/v1/support/" + ticketId + "/messages")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-store")
            .header("Authorization", "Bearer " + token)
            .post(body).build()
        val data = financialClient.newCall(req).execute().use(::apiJson)
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
