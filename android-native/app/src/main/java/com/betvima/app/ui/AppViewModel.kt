package com.betvima.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.betvima.app.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.math.BigDecimal
import java.math.RoundingMode

enum class Tab { HOME, LIVE, SPORTS, BETS, WALLET }
enum class HomeMode { TOP, TOP_BETS }
enum class Feature { NONE, PROFILE, BONUSES, VIP, SUPPORT, CASINO, AFFILIATE, NOTIFICATIONS }
enum class Lang { EN, FA }

data class AppState(
    val tab: Tab = Tab.HOME, val homeMode: HomeMode = HomeMode.TOP,
    val feature: Feature = Feature.NONE,
    val lang: Lang = Lang.FA, val sport: String = "all",
    val tournamentLeague: String = "",
    val live: List<Match> = emptyList(), val upcoming: List<Match> = emptyList(),
    val liveLoading: Boolean = false, val upcomingLoading: Boolean = false,
    val detailLoading: Boolean = false,
    val liveEnabled: Boolean = false, val detail: Match? = null,
    val betDetail: BetDetail? = null, val betDetailLoading: Boolean = false,
    val betDetailVisible: Boolean = false,
    val ticketMatches: Map<String, Match> = emptyMap(),
    val picks: List<Pick> = emptyList(), val showSlip: Boolean = false,
    val showLogin: Boolean = false, val registerScreen: Boolean = false,
    val authError: String? = null,
    val signedIn: Boolean = false,
    val accountName: String? = null,
    val wallet: Wallet? = null, val bets: List<Bet> = emptyList(),
    val betsPage: Int = 1, val betsHasMore: Boolean = false,
    val historyQuery: BetHistoryQuery = BetHistoryQuery(),
    val historyBets: List<Bet> = emptyList(), val historyPage: Int = 1,
    val historyHasMore: Boolean = false, val historyLoading: Boolean = false,
    val historyMoreLoading: Boolean = false, val historyError: String? = null,
    val moreBetsLoading: Boolean = false, val moreWalletLoading: Boolean = false,
    val notifications: List<UserNotification> = emptyList(),
    val notificationPage: Int = 1, val notificationHasMore: Boolean = false,
    val notificationLoading: Boolean = false,
    val bonuses: List<Bonus> = emptyList(), val busy: Boolean = false,
    val accountLoading: Boolean = false,
    val quote: String? = null, val notice: String? = null,
    val searchTerm: String = "", val searchLoading: Boolean = false,
    val searchLive: List<Match> = emptyList(),
    val searchUpcoming: List<Match> = emptyList(),
    val searchError: String? = null
)

/** Screen state lives outside composables; every value comes from BetVima API. */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient()
    private val vault = SessionVault(app)
    private val preferences = app.getSharedPreferences("native_preferences", android.content.Context.MODE_PRIVATE)
    private var sessionGeneration = 0
    private var liveRequestNumber = 0
    private var upcomingRequestNumber = 0
    private var detailRequestNumber = 0
    private var accountRequestNumber = 0
    private var quoteGeneration = 0
    private var historyRequest = 0
    private var searchGeneration = 0
    private var liveRequestInFlight = false
    private val ticketLookupFailures = mutableSetOf<String>()
    private val ticketLookupInFlight = mutableSetOf<String>()
    private val ticketLookupSemaphore = Semaphore(2)
    private val mutable = MutableStateFlow(AppState(
        signedIn = vault.signedIn(),
        lang = if (preferences.getString("language", "fa") == "en") Lang.EN else Lang.FA
    ))
    val state = mutable.asStateFlow()
    init {
        refreshAll()
        if (vault.signedIn()) {
            refreshAccount()
            refreshNotifications()
        }
    }
    fun notice(message: String?) = mutable.update { it.copy(notice = message) }
    fun language() =
        setLanguage(if (state.value.lang == Lang.EN) Lang.FA else Lang.EN)
    fun setLanguage(lang: Lang) {
        preferences.edit().putString("language", if (lang == Lang.FA) "fa" else "en").apply()
        mutable.update { it.copy(lang = lang) }
    }
    fun homeMode(mode: HomeMode) {
        detailRequestNumber++
        mutable.update { it.copy(tab = Tab.HOME, homeMode = mode, feature = Feature.NONE,
            detail = null, detailLoading = false) }
        if (mode == HomeMode.TOP_BETS && state.value.upcoming.isEmpty()) refreshUpcoming()
    }
    fun tab(tab: Tab) {
        detailRequestNumber++
        mutable.update { it.copy(tab = tab, feature = Feature.NONE,
            homeMode = if (tab == Tab.HOME) HomeMode.TOP else it.homeMode,
            tournamentLeague = if (tab == Tab.SPORTS) "" else it.tournamentLeague,
            detail = null, detailLoading = false) }
        when (tab) {
            Tab.HOME -> refreshAll()
            Tab.LIVE -> refreshLive()
            Tab.SPORTS -> refreshUpcoming()
            Tab.BETS -> if (state.value.signedIn) refreshBetHistory()
            Tab.WALLET -> if (state.value.signedIn) refreshAccount()
            else -> Unit
        }
    }
    fun feature(feature: Feature) {
        detailRequestNumber++
        mutable.update { it.copy(feature = feature, detail = null, detailLoading = false) }
        if (feature == Feature.BONUSES && state.value.signedIn) refreshAccount()
        if (feature == Feature.NOTIFICATIONS && state.value.signedIn) refreshNotifications()
    }
    fun tournament(leagueKey: String) {
        detailRequestNumber++
        mutable.update {
            it.copy(tab = Tab.SPORTS, feature = Feature.NONE, sport = "all",
                tournamentLeague = leagueKey, detail = null, detailLoading = false)
        }
        refreshUpcoming()
    }
    fun sport(sport: String) {
        if (state.value.sport == sport && state.value.tournamentLeague.isBlank()) return
        mutable.update { it.copy(sport = sport, tournamentLeague = "") }
        if (state.value.tab == Tab.SPORTS) refreshUpcoming()
    }
    fun refreshAll() {
        refreshLive()
        refreshUpcoming()
    }
    fun refreshLive(silent: Boolean = false) = viewModelScope.launch {
        if (liveRequestInFlight) return@launch
        liveRequestInFlight = true
        val request = ++liveRequestNumber
        if (!silent) mutable.update { it.copy(liveLoading = true) }
        try {
            val (matches, liveEnabled) = api.live()
            if (request == liveRequestNumber) mutable.update {
                it.copy(live = matches, liveEnabled = liveEnabled, liveLoading = false)
            }
        } catch (ex: Exception) {
            if (request == liveRequestNumber) mutable.update {
                // Keep last known scores visible, but never leave live wagering shown as enabled
                // after losing connection to the authoritative feed.
                it.copy(liveEnabled = false, liveLoading = false,
                    notice = if (silent) it.notice else tr(it.lang,
                        "Live data unavailable. Showing last received scores.",
                        "اتصال داده زنده قطع شد؛ آخرین نتایج دریافت‌شده نمایش داده می‌شود."))
            }
        } finally {
            liveRequestInFlight = false
        }
    }
    fun refreshUpcoming() {
        val requestedSport = state.value.sport
        val request = ++upcomingRequestNumber
        mutable.update { it.copy(upcomingLoading = true) }
        viewModelScope.launch {
            try {
                val events = api.upcoming(requestedSport)
                if (request == upcomingRequestNumber && state.value.sport == requestedSport)
                    mutable.update { it.copy(upcoming = events, upcomingLoading = false) }
            } catch (ex: Exception) {
                if (request == upcomingRequestNumber && state.value.sport == requestedSport)
                    mutable.update {
                        it.copy(upcomingLoading = false, notice = tr(it.lang,
                            "Unable to load the selected sport.", "بارگذاری مسابقات این رشته ناموفق بود."))
                    }
            }
        }
    }
    fun clearSearch() {
        ++searchGeneration
        mutable.update { it.copy(searchTerm = "", searchLive = emptyList(),
            searchUpcoming = emptyList(), searchLoading = false, searchError = null) }
    }

    /**
     * Accepts debounced queries from the native search sheet.
     * Generation guards ensure a slower old request can never replace new results.
     */
    fun searchMatches(query: String) {
        val term = query.trim()
        val generation = ++searchGeneration
        if (term.length < 2) {
            mutable.update { it.copy(searchTerm = term, searchLoading = false,
                searchLive = emptyList(), searchUpcoming = emptyList(), searchError = null) }
            return
        }
        mutable.update { it.copy(searchTerm = term, searchLoading = true,
            searchLive = emptyList(), searchUpcoming = emptyList(), searchError = null) }
        viewModelScope.launch {
            val found = supervisorScope {
                val live = async { runCatching { api.searchMatches(term, true) } }
                val upcoming = async { runCatching { api.searchMatches(term, false) } }
                live.await() to upcoming.await()
            }
            if (generation != searchGeneration) return@launch
            val liveMatches = found.first.getOrDefault(emptyList())
            val upcomingMatches = found.second.getOrDefault(emptyList())
            val bothFailed = found.first.isFailure && found.second.isFailure
            mutable.update { it.copy(searchLoading = false, searchLive = liveMatches,
                searchUpcoming = upcomingMatches,
                searchError = if (bothFailed) tr(it.lang,
                    "Search is temporarily unavailable. Please retry.",
                    "جست‌وجو موقتاً در دسترس نیست؛ دوباره تلاش کنید.") else null) }
        }
    }

    fun openMatch(id: String) = viewModelScope.launch {
        val request = ++detailRequestNumber
        mutable.update { it.copy(detailLoading = true, detail = null) }
        try {
            val match = api.detail(id)
            if (request == detailRequestNumber) mutable.update {
                it.copy(detail = match, detailLoading = false)
            }
        } catch (ex: Exception) {
            if (request == detailRequestNumber) mutable.update {
                it.copy(detailLoading = false, notice = tr(it.lang,
                    "Match details unavailable.", "جزئیات مسابقه در دسترس نیست."))
            }
        }
    }
    fun closeMatch() {
        detailRequestNumber++
        mutable.update { it.copy(detail = null, detailLoading = false) }
    }
    fun togglePick(match: Match, market: Market, selection: Selection) {
        if (!match.bettingAvailable || !market.available || !selection.available ||
            (match.live && !state.value.liveEnabled)) return
        quoteGeneration++
        val persian = state.value.lang == Lang.FA
        val entry = Pick(match.id, market.id, selection.id, match.title,
            market.label(persian), selection.label(persian),
            selection.oddsScaled, market.version, match.live)
        mutable.update { s ->
            val picks = if (s.picks.any { it.selectionId == entry.selectionId }) {
                s.picks.filterNot { it.selectionId == entry.selectionId }
            } else {
                // A multi-bet cannot contain competing selections from the same match.
                s.picks.filterNot { it.matchId == entry.matchId } + entry
            }
            s.copy(picks = picks.take(20), showSlip = picks.isNotEmpty(), quote = null)
        }
    }
    fun removePick(id: String) {
        quoteGeneration++
        mutable.update {
            val picks = it.picks.filterNot { p -> p.selectionId == id }
            it.copy(picks = picks, quote = null, showSlip = picks.isNotEmpty())
        }
    }
    /** Replace the sheet only after explicit import confirmation.
     *  Odds must be refreshed from the public first-party share endpoint.
     */
    fun replacePicksFromCode(picks: List<Pick>) {
        require(picks.size in 1..20)
        require(picks.map { it.matchId }.distinct().size == picks.size)
        quoteGeneration++
        mutable.update { it.copy(
            picks = picks, quote = null, busy = false, showSlip = true)
        }
    }
    fun clearPicks() {
        quoteGeneration++
        mutable.update { it.copy(picks = emptyList(), quote = null, busy = false) }
    }
    fun openBet(id: String) = viewModelScope.launch {
        if (!state.value.signedIn) {
            showLogin(true)
            return@launch
        }
        val generation = sessionGeneration
        mutable.update { it.copy(betDetailVisible = true, betDetailLoading = true, betDetail = null) }
        try {
            val jwt = vault.accessToken(api) ?: throw ApiFailure(401, "Authentication required")
            val detail = api.betDetail(jwt, id)
            if (generation == sessionGeneration && state.value.betDetailVisible) mutable.update {
                it.copy(betDetail = detail, betDetailLoading = false)
            }
            resolveTicketMatches(detail.legs.map { it.matchId })
        } catch (ex: Exception) {
            if (generation == sessionGeneration) mutable.update {
                it.copy(betDetailLoading = false, betDetailVisible = false,
                    notice = tr(it.lang, "Unable to open this bet receipt.",
                        "نمایش جزئیات این شرط ممکن نشد."))
            }
        }
    }
    fun closeBet() = mutable.update {
        it.copy(betDetailVisible = false, betDetailLoading = false, betDetail = null)
    }

    /** Best-effort name/score enrichment, independent from financial settlement. */
    private fun resolveTicketMatches(ids: List<String>) {
        val target = ids.filter { id ->
            id.matches(Regex("[0-9a-fA-F-]{36}")) &&
                id !in state.value.ticketMatches &&
                id !in ticketLookupFailures && id !in ticketLookupInFlight
        }.distinct().take(8)
        val generation = sessionGeneration
        for (id in target) {
            ticketLookupInFlight.add(id)
            viewModelScope.launch {
                try {
                    ticketLookupSemaphore.withPermit {
                        val match = api.match(id)
                        if (generation == sessionGeneration && state.value.signedIn) {
                            mutable.update {
                                it.copy(ticketMatches = it.ticketMatches + (id to match))
                            }
                        }
                    }
                } catch (_: Exception) {
                    if (generation == sessionGeneration) ticketLookupFailures.add(id)
                } finally {
                    ticketLookupInFlight.remove(id)
                }
            }
        }
    }
    fun clearQuote() {
        quoteGeneration++
        mutable.update { it.copy(quote = null, busy = false) }
    }
    fun showSlip(show: Boolean) = mutable.update { it.copy(showSlip = show) }
    fun showLogin(show: Boolean, register: Boolean = false) =
        mutable.update { it.copy(showLogin = show, registerScreen = register, authError = null) }
    fun setRegisterScreen(register: Boolean) =
        mutable.update { it.copy(registerScreen = register, authError = null) }
    fun signIn(email: String, password: String, navigateHome: Boolean = false) = viewModelScope.launch {
        if (state.value.busy) return@launch
        if (!email.trim().contains("@") || password.length !in 8..128) {
            mutable.update { it.copy(authError = tr(it.lang,
                "Check your email and password.", "ایمیل و رمز عبور را بررسی کنید.")) }
            return@launch
        }
        mutable.update { it.copy(busy = true, notice = null, authError = null) }
        try {
            vault.signIn(email.trim(), password, api)
            sessionGeneration++
            mutable.update { it.copy(
                busy = false, showLogin = false, signedIn = true, authError = null,
                tab = if (navigateHome) Tab.HOME else it.tab,
                homeMode = if (navigateHome) HomeMode.TOP else it.homeMode,
                feature = if (navigateHome) Feature.NONE else it.feature,
                detail = if (navigateHome) null else it.detail,
                detailLoading = if (navigateHome) false else it.detailLoading
            ) }
            if (navigateHome) refreshAll()
            refreshAccount()
            if (state.value.tab == Tab.BETS) refreshBetHistory()
            refreshNotifications()
        } catch (ex: Exception) {
            val text = when ((ex as? ApiFailure)?.code) {
                400, 401, 403 -> tr(state.value.lang,
                    "Incorrect credentials or verification required.",
                    "مشخصات ورود نادرست است یا تأیید حساب لازم است.")
                429 -> tr(state.value.lang,
                    "Too many attempts. Please try again later.",
                    "تلاش بیش از حد مجاز؛ کمی بعد دوباره امتحان کنید.")
                else -> tr(state.value.lang,
                    "We could not sign in. Check your connection and retry.",
                    "ورود انجام نشد؛ اتصال اینترنت را بررسی و دوباره تلاش کنید.")
            }
            mutable.update { it.copy(busy = false, authError = text) }
        }
    }
    fun signOut() {
        closeBet()
        closeMatch()
        quoteGeneration++
        accountRequestNumber++
        historyRequest++
        sessionGeneration++
        vault.clear()
        ticketLookupFailures.clear()
        ticketLookupInFlight.clear()
        mutable.update { it.copy(signedIn = false, accountName = null, wallet = null, bets = emptyList(), ticketMatches = emptyMap(),
            bonuses = emptyList(), quote = null, showLogin = false,
            authError = null, accountLoading = false,
            betsPage = 1, betsHasMore = false, moreBetsLoading = false,
            historyQuery = BetHistoryQuery(), historyBets = emptyList(), historyPage = 1,
            historyHasMore = false, historyLoading = false,
            historyMoreLoading = false, historyError = null,
            moreWalletLoading = false,
            notifications = emptyList(), notificationPage = 1, notificationHasMore = false,
            notificationLoading = false) }
    }
    // Financial mutations stay behind the encrypted SessionVault. Compose never
    // sees the access token; the server revalidates method switches, balances,
    // currency, limits, rate quotes and ownership on every operation.
    private suspend fun walletJwt(): String {
        if (!state.value.signedIn) throw ApiFailure(401, "Sign in required")
        return vault.accessToken(api)?.takeIf(String::isNotBlank)
            ?: throw ApiFailure(401, "Your secure session has expired")
    }
    suspend fun walletPaymentMethods(direction: String, currency: String): WalletMethodCatalogue =
        api.walletMethods(direction, currency)
    suspend fun walletVoucherReference(): WalletExchangeQuote =
        api.walletVoucherQuote(walletJwt())
    suspend fun walletUsdRate(): String = api.walletUsdIrrRate(walletJwt())
    suspend fun walletCreateDeposit(payload: org.json.JSONObject, idempotency: String): WalletPaymentIntent {
        if (state.value.wallet?.integrity != "ok") throw ApiFailure(409, "Wallet ledger verification required")
        return api.createWalletDeposit(walletJwt(), payload, idempotency)
    }
    suspend fun walletCreateWithdrawal(payload: org.json.JSONObject, idempotency: String): WalletPaymentIntent {
        if (state.value.wallet?.integrity != "ok") throw ApiFailure(409, "Wallet ledger verification required")
        return api.createWalletWithdrawal(walletJwt(), payload, idempotency)
    }
    suspend fun walletVoucherStatus(publicId: String): WalletPaymentIntent =
        api.voucherPaymentStatus(walletJwt(), publicId)

    fun refreshAccount() = viewModelScope.launch {
        if (!state.value.signedIn) return@launch
        val generation = sessionGeneration
        val request = ++accountRequestNumber
        mutable.update { it.copy(accountLoading = true) }
        val jwt = vault.accessToken(api)
        if (jwt.isNullOrBlank()) {
            if (sessionGeneration == generation && request == accountRequestNumber) {
                if (!vault.signedIn()) {
                    // A definitive 4xx refresh denial: replace member header with login.
                    // Offline/timeout refreshes keep the encrypted session intact.
                    signOut()
                    notice(tr(state.value.lang,
                        "Session expired. Please log in again.",
                        "نشست منقضی شد؛ لطفاً دوباره وارد شوید."))
                } else mutable.update {
                    it.copy(accountLoading = false, notice = tr(it.lang,
                        "Unable to refresh your session. Please retry.",
                        "تمدید نشست ممکن نشد؛ دوباره تلاش کنید."))
                }
            }
            return@launch
        }
        supervisorScope {
            // A temporary error in a single service must not erase confirmed wallet data.
            val wallet = async { runCatching { api.wallet(jwt) } }
            val bets = async { runCatching { api.bets(jwt) } }
            val bonuses = async { runCatching { api.bonuses(jwt) } }
            val profile = async { runCatching { api.get("/api/v1/account/profile", jwt) } }
            val walletResult = wallet.await()
            val betResult = bets.await()
            val bonusResult = bonuses.await()
            val remoteProfile = profile.await().getOrNull()?.optJSONObject("profile")
            val remoteName = listOf("displayName", "username")
                .firstNotNullOfOrNull { key ->
                    remoteProfile?.optString(key)?.trim()?.takeIf { it.isNotEmpty() }
                }
            if (sessionGeneration != generation || request != accountRequestNumber ||
                !state.value.signedIn) return@supervisorScope
            mutable.update {
                it.copy(
                    wallet = walletResult.getOrNull() ?: it.wallet,
                    accountName = remoteName ?: it.accountName,
                    bets = betResult.getOrNull()?.items ?: it.bets,
                    betsPage = betResult.getOrNull()?.page ?: it.betsPage,
                    betsHasMore = betResult.getOrNull()?.hasMore ?: it.betsHasMore,
                    bonuses = bonusResult.getOrNull() ?: it.bonuses,
                    accountLoading = false,
                    notice = if (walletResult.isFailure || betResult.isFailure || bonusResult.isFailure)
                        tr(it.lang, "Some account information could not be refreshed.",
                            "بخشی از اطلاعات حساب به‌روزرسانی نشد.") else it.notice
                )
            }
        }
    }
    fun setBetHistoryQuery(filter: BetHistoryQuery) {
        if (state.value.historyQuery == filter) return
        ++historyRequest
        mutable.update {
            it.copy(historyQuery = filter, historyBets = emptyList(),
                historyPage = 1, historyHasMore = false, historyError = null)
        }
        refreshBetHistory()
    }

    fun refreshBetHistory(more: Boolean = false, silent: Boolean = false) = viewModelScope.launch {
        val snapshot = state.value
        if (!snapshot.signedIn) return@launch
        if (silent && (snapshot.historyLoading || snapshot.historyMoreLoading ||
            snapshot.historyPage > 1)) return@launch
        if (more && (snapshot.historyLoading || snapshot.historyMoreLoading ||
            !snapshot.historyHasMore || snapshot.historyPage >= 1000)) return@launch
        val generation = sessionGeneration
        val request = if (more) historyRequest else ++historyRequest
        val filter = snapshot.historyQuery
        mutable.update {
            it.copy(historyLoading = if (more || silent) it.historyLoading else true,
                historyMoreLoading = more, historyError = if (silent) it.historyError else null)
        }
        try {
            val jwt = vault.accessToken(api)
                ?: throw ApiFailure(401, "Session unavailable")
            val response = api.betHistory(jwt, filter, if (more) snapshot.historyPage + 1 else 1)
            if (generation == sessionGeneration && request == historyRequest &&
                state.value.historyQuery == filter && state.value.signedIn) mutable.update {
                it.copy(historyBets = if (more)
                    (it.historyBets + response.items).distinctBy { item -> item.id }
                    else response.items,
                    historyPage = response.page, historyHasMore = response.hasMore,
                    historyLoading = false, historyMoreLoading = false,
                    historyError = null)
            }
            if (generation == sessionGeneration && request == historyRequest &&
                state.value.signedIn) {
                resolveTicketMatches(response.items.flatMap { bet ->
                    bet.selections.map { it.matchId }
                })
            }
        } catch (ex: Exception) {
            if (!silent && generation == sessionGeneration && request == historyRequest) mutable.update {
                it.copy(historyLoading = false, historyMoreLoading = false,
                    historyError = tr(it.lang,
                        "Could not load bet history. Try again.",
                        "تاریخچه شرط‌ها دریافت نشد؛ دوباره تلاش کنید."))
            }
        }
    }

    fun refreshNotifications(more: Boolean = false) = viewModelScope.launch {
        val snapshot = state.value
        if (!snapshot.signedIn || snapshot.notificationLoading ||
            (more && (!snapshot.notificationHasMore || snapshot.notificationPage >= 1000))) return@launch
        val generation = sessionGeneration
        mutable.update { it.copy(notificationLoading = true) }
        try {
            val jwt = vault.accessToken(api) ?: throw ApiFailure(401, "Authentication required")
            val page = api.notifications(jwt, if (more) snapshot.notificationPage + 1 else 1)
            if (generation == sessionGeneration && state.value.signedIn) mutable.update {
                it.copy(
                    notifications = if (more)
                        (it.notifications + page.items).distinctBy { n -> n.id } else page.items,
                    notificationPage = page.page,
                    notificationHasMore = page.hasMore,
                    notificationLoading = false
                )
            }
        } catch (ex: Exception) {
            if (generation == sessionGeneration) mutable.update {
                it.copy(notificationLoading = false,
                    notice = tr(it.lang, "Could not load notifications.",
                        "دریافت اعلان‌ها ناموفق بود."))
            }
        }
    }
    fun markNotificationRead(id: String) = viewModelScope.launch {
        val generation = sessionGeneration
        val jwt = vault.accessToken(api) ?: return@launch
        try {
            api.readNotifications(jwt, ids = listOf(id))
            if (generation == sessionGeneration && state.value.signedIn) mutable.update {
                it.copy(notifications = it.notifications.map { note ->
                    if (note.id == id) note.copy(readAt = java.time.Instant.now().toString()) else note
                })
            }
        } catch (ex: Exception) {
            if (generation == sessionGeneration) notice(
                tr(state.value.lang, "Could not mark as read.", "ثبت وضعیت خوانده‌شده ناموفق بود."))
        }
    }
    fun markAllNotificationsRead() = viewModelScope.launch {
        val generation = sessionGeneration
        val jwt = vault.accessToken(api) ?: return@launch
        try {
            api.readNotifications(jwt, all = true)
            if (generation == sessionGeneration && state.value.signedIn) mutable.update {
                it.copy(notifications = it.notifications.map { note ->
                    note.copy(readAt = note.readAt ?: java.time.Instant.now().toString())
                })
            }
        } catch (ex: Exception) {
            if (generation == sessionGeneration) notice(
                tr(state.value.lang, "Could not mark notifications as read.",
                    "ثبت وضعیت اعلان‌ها ناموفق بود."))
        }
    }
    fun loadMoreBets() = viewModelScope.launch {
        val snapshot = state.value
        if (!snapshot.signedIn || !snapshot.betsHasMore || snapshot.moreBetsLoading ||
            snapshot.accountLoading || snapshot.betsPage >= 1000) return@launch
        val generation = sessionGeneration
        mutable.update { it.copy(moreBetsLoading = true) }
        try {
            val jwt = vault.accessToken(api) ?: throw ApiFailure(401, "Authentication required")
            val next = api.bets(jwt, snapshot.betsPage + 1)
            if (generation == sessionGeneration && state.value.signedIn) mutable.update {
                it.copy(bets = (it.bets + next.items).distinctBy { bet -> bet.id },
                    betsPage = next.page, betsHasMore = next.hasMore, moreBetsLoading = false)
            }
        } catch (ex: Exception) {
            if (generation == sessionGeneration) mutable.update {
                it.copy(moreBetsLoading = false,
                    notice = tr(it.lang, "Could not load more bets.", "بارگذاری شرط‌های بیشتر ناموفق بود."))
            }
        }
    }
    fun loadMoreWallet() = viewModelScope.launch {
        val snapshot = state.value
        val previous = snapshot.wallet
        if (!snapshot.signedIn || previous == null || !previous.hasMore ||
            snapshot.moreWalletLoading || snapshot.accountLoading || previous.page >= 1000) return@launch
        val generation = sessionGeneration
        mutable.update { it.copy(moreWalletLoading = true) }
        try {
            val jwt = vault.accessToken(api) ?: throw ApiFailure(401, "Authentication required")
            val page = api.wallet(jwt, previous.page + 1)
            if (generation == sessionGeneration && state.value.signedIn) mutable.update {
                val prior = it.wallet ?: previous
                it.copy(wallet = page.copy(transactions =
                    (prior.transactions + page.transactions).distinctBy { tx -> tx.id }),
                    moreWalletLoading = false)
            }
        } catch (ex: Exception) {
            if (generation == sessionGeneration) mutable.update {
                it.copy(moreWalletLoading = false,
                    notice = tr(it.lang, "Could not load more transactions.",
                        "بارگذاری تراکنش‌های بیشتر ناموفق بود."))
            }
        }
    }
    fun quote(stake: String) = viewModelScope.launch {
        val selectedPicks = state.value.picks.toList()
        if (selectedPicks.isEmpty()) return@launch
        val request = ++quoteGeneration
        val generation = sessionGeneration
        val cents = runCatching {
            BigDecimal(stake).movePointRight(2).setScale(0, RoundingMode.UNNECESSARY)
                .toBigIntegerExact().also { require(it.signum() > 0) }.toString()
        }.getOrElse {
            notice("Enter a valid USD stake with at most two decimal places")
            return@launch
        }
        val jwt = vault.accessToken(api) ?: run {
            showLogin(true)
            return@launch
        }
        mutable.update { it.copy(busy = true, quote = null) }
        try {
            val result = api.quote(jwt, selectedPicks, cents).optJSONObject("quote")
            val payout = result?.optString("potentialPayoutMinor").orEmpty()
            if (request == quoteGeneration && generation == sessionGeneration &&
                selectedPicks == state.value.picks) mutable.update {
                it.copy(busy = false, quote =
                    if (payout.isNotBlank()) money(payout, "USD") else null)
            }
        } catch (ex: Exception) {
            if (request == quoteGeneration && generation == sessionGeneration)
                mutable.update { it.copy(busy = false,
                    notice = tr(it.lang, "Quote unavailable", "استعلام ضریب ناموفق بود.")) }
        }
    }
}
