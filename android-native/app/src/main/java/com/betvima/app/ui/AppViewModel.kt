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
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.math.BigDecimal
import java.math.RoundingMode

enum class Tab { HOME, LIVE, SPORTS, BETS, WALLET }
enum class HomeMode { TOP, TOP_BETS }
enum class Feature { NONE, PROFILE, BONUSES, VIP, SUPPORT, CASINO, AFFILIATE, NOTIFICATIONS }
enum class Lang { EN, FA }

/** Ephemeral visual-only signal, never used in pricing or settlement. */
data class PickFlight84(
    val revision: Long,
    val selectionId: String,
    val originX: Float,
    val originY: Float,
    val oddsText: String
)

data class AppState(
    val tab: Tab = Tab.HOME, val homeMode: HomeMode = HomeMode.TOP,
    val feature: Feature = Feature.NONE,
    val lang: Lang = Lang.EN, val sport: String = "all",
    val tournamentLeague: String = "",
    val live: List<Match> = emptyList(), val upcoming: List<Match> = emptyList(),
    val liveLoading: Boolean = false, val upcomingLoading: Boolean = false,
    val detailLoading: Boolean = false,
    val liveEnabled: Boolean = false, val wageringEnabled: Boolean = false,
    val detail: Match? = null,
    val liveFacts: LiveMatchFacts? = null,
    val focusedMarketId: String? = null,
    val betDetail: BetDetail? = null, val betDetailLoading: Boolean = false,
    val betDetailVisible: Boolean = false,
    val ticketMatches: Map<String, Match> = emptyMap(),
    val picks: List<Pick> = emptyList(), val showSlip: Boolean = false,
    val pickFlight: PickFlight84? = null,
    val showLogin: Boolean = false, val registerScreen: Boolean = false,
    val authError: String? = null, val mfaRequired: Boolean = false,
    val mfaChoices: List<AuthenticatorFactor> = emptyList(),
    val selectedMfaFactor: String? = null,
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
    val notificationUnreadCount: Int = 0, val notificationError: String? = null,
    val notificationLoading: Boolean = false,
    val bonuses: List<Bonus> = emptyList(), val busy: Boolean = false,
    val accountLoading: Boolean = false,
    val quote: String? = null, val mainBetReview: MainBetReview? = null,
    val mainOddsAcceptedToken: String? = null,
    val mainBetUncertain: Boolean = false, val notice: String? = null,
    val searchTerm: String = "", val searchLoading: Boolean = false,
    val searchLive: List<Match> = emptyList(),
    val searchUpcoming: List<Match> = emptyList(),
    val searchError: String? = null
)

/** Screen state lives outside composables; every value comes from BetVima API. */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient()
    private val vault = SessionVault(app)
    // First factor session is ephemeral and never written to storage.
    private var pendingMfaSession: org.json.JSONObject? = null
    private var pendingMfaFactor: String? = null
    private var pendingMfaNavigateHome = false
    private val preferences = app.getSharedPreferences("native_preferences", android.content.Context.MODE_PRIVATE)
    private var sessionGeneration = 0
    private var liveRequestNumber = 0
    private var upcomingRequestNumber = 0
    private var detailRequestNumber = 0
    private var factsInFlight = false
    private var accountRequestNumber = 0
    private var quoteGeneration = 0
    private var mainBetSubmitting = false
    private var mainOddsPolling = false
    private var flightRevision = 0L
    private var historyRequest = 0
    private var searchGeneration = 0
    private var liveRequestInFlight = false
    private val ticketLookupFailures = mutableSetOf<String>()
    private val ticketLookupInFlight = mutableSetOf<String>()
    private val ticketLookupSemaphore = Semaphore(2)
    private val mutable = MutableStateFlow(AppState(
        signedIn = vault.signedIn(),
        lang = if (preferences.getString("language", "en") == "en") Lang.EN else Lang.FA
    ))
    val state = mutable.asStateFlow()
    init {
        refreshWageringAvailability()
        refreshAll()
        if (vault.signedIn()) {
            refreshAccount()
            refreshNotifications()
        }
    }
    fun notice(message: String?) = mutable.update { it.copy(notice = message) }

    /** Bootstrap reflects server kill switches, never a local permanent false. */
    fun refreshWageringAvailability() = viewModelScope.launch {
        val available = runCatching { api.wageringAvailable() }.getOrDefault(false)
        mutable.update { it.copy(wageringEnabled = available) }
    }
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
        // Recheck provider previews when the user opens Top Bets, even if an
        // earlier feed contained only unpriced fixtures. Both LIVE and upcoming
        // contribute to the market-variety ranking.
        if (mode == HomeMode.TOP_BETS) refreshAll()
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
    /** Casino is a native screen; the server owns the provider credentials and wallet. */
    suspend fun casinoGames(page: Int, category: String, query: String, provider: String): CasinoPage =
        api.casinoGames(page, category, query, provider)

    suspend fun casinoEligibility(): com.betvima.app.data.CasinoEligibility {
        val token = vault.accessToken(api)?.takeIf(String::isNotBlank)
            ?: throw ApiFailure(401, "Please sign in to view casino eligibility")
        return api.casinoEligibility(token)
    }

    suspend fun casinoRealMoneyLaunch(gameId: String, language: Lang): String {
        val token = vault.accessToken(api)?.takeIf(String::isNotBlank)
            ?: throw ApiFailure(401, "Please sign in to open a game")
        // Backend rechecks test-account allowlist and wallet eligibility.
        return api.casinoLaunch(token, gameId, demo = false,
            lang = if (language == Lang.FA) "fa" else "en")
    }

    suspend fun casinoDemoLaunch(gameId: String, language: Lang): String {
        val token = vault.accessToken(api)?.takeIf(String::isNotBlank)
            ?: throw ApiFailure(401, "Please sign in to open a demo game")
        return api.casinoLaunch(token, gameId, demo = true,
            lang = if (language == Lang.FA) "fa" else "en")
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

    fun openPickMarket(pick: Pick) {
        mutable.update { it.copy(focusedMarketId = pick.marketId, showSlip = false) }
        openMatch(pick.matchId)
    }

    fun openMatch(id: String) = viewModelScope.launch {
        val request = ++detailRequestNumber
        mutable.update { it.copy(detailLoading = true, detail = null, liveFacts = null) }
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
    /** Refresh factual scoreboard/stats without mutating markets, bets or UI routing. */
    fun refreshMatchFacts(id: String) = viewModelScope.launch {
        if (factsInFlight || state.value.detail?.id != id) return@launch
        factsInFlight = true
        val generation = detailRequestNumber
        try {
            val facts = api.matchFacts(id)
            if (facts != null && generation == detailRequestNumber &&
                state.value.detail?.id == id) {
                mutable.update { current ->
                    val old = current.detail
                    current.copy(
                        liveFacts = facts,
                        detail = old?.copy(
                            minute = facts.minute ?: old.minute,
                            clockSeconds = facts.clockSeconds ?: old.clockSeconds,
                            clockRunning = if (facts.clockSeconds != null) facts.clockRunning
                                else old.clockRunning,
                            clockObservedAt = if (facts.clockSeconds != null)
                                facts.observedAt else old.clockObservedAt,
                            homeScore = facts.score?.substringBefore('-')?.toIntOrNull()
                                ?: old.homeScore,
                            awayScore = facts.score?.substringAfter('-')?.toIntOrNull()
                                ?: old.awayScore
                        )
                    )
                }
            }
        } catch (_: Exception) {
            // Retain last confirmed data on transient provider/network failures.
        } finally {
            factsInFlight = false
        }
    }

    fun closeMatch() {
        detailRequestNumber++
        mutable.update { it.copy(detail = null, liveFacts = null,
            detailLoading = false, focusedMarketId = null) }
    }
    /** Purely informational odds polling. Never touches quotes or financial state. */
    suspend fun slipProbabilitySnapshots(matchIds: List<String>): Map<String, SlipOddsMatch> =
        supervisorScope {
            // A temporary failure on one event must never blank the entire mix.
            // The pure estimator separately labels every leg using a price-only fallback.
            val semaphore = Semaphore(4)
            matchIds.distinct().take(20).map { id ->
                async {
                    semaphore.withPermit {
                        runCatching { api.slipProbabilityOdds(id) }.getOrNull()
                    }
                }
            }.awaitAll().filterNotNull().associateBy { it.matchId }
        }

    fun togglePick(
        match: Match, market: Market, selection: Selection,
        originX: Float = Float.NaN, originY: Float = Float.NaN
    ) {
        if (!match.bettingAvailable || !market.available || !selection.available ||
            (match.live && !state.value.liveEnabled)) return
        quoteGeneration++
        val persian = state.value.lang == Lang.FA
        val entry = Pick(match.id, market.id, selection.id, match.title,
            market.label(persian), selection.label(persian),
            selection.oddsScaled, market.version, match.live)
        mutable.update { s ->
            val existed = s.picks.any { it.selectionId == entry.selectionId }
            val picks = if (existed) {
                s.picks.filterNot { it.selectionId == entry.selectionId }
            } else {
                s.picks.filterNot { it.matchId == entry.matchId } + entry
            }
            val kept = picks.takeLast(20)
            val added = !existed && kept.any { it.selectionId == entry.selectionId }
            val motion = if (added) PickFlight84(
                ++flightRevision, entry.selectionId, originX, originY,
                com.betvima.app.data.odds(selection.oddsScaled)
            ) else null
            // Adding an odd starts the flight; the sheet opens only after it lands.
            // Removing a pick never launches a ghost flight.
            s.copy(
                picks = kept,
                showSlip = if (added) false else s.showSlip && kept.isNotEmpty(),
                pickFlight = motion,
                quote = null, mainBetReview = null, mainOddsAcceptedToken = null
            )
        }
    }

    fun finishPickFlight(revision: Long) {
        mutable.update { s ->
            val flight = s.pickFlight
            if (flight == null || flight.revision != revision) s
            else s.copy(
                pickFlight = null,
                showSlip = s.picks.any { it.selectionId == flight.selectionId }
            )
        }
    }
    fun removePick(id: String) {
        quoteGeneration++
        mutable.update {
            val picks = it.picks.filterNot { p -> p.selectionId == id }
            it.copy(picks = picks, quote = null, mainBetReview = null, mainOddsAcceptedToken = null,
                showSlip = picks.isNotEmpty(),
                pickFlight = null)
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
            picks = picks, quote = null, mainBetReview = null, mainOddsAcceptedToken = null, busy = false, showSlip = true,
            pickFlight = null)
        }
    }
    fun clearPicks() {
        quoteGeneration++
        mutable.update { it.copy(picks = emptyList(), quote = null, mainBetReview = null, mainOddsAcceptedToken = null, busy = false,
            pickFlight = null) }
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
                        val match = api.detail(id)
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
        mutable.update { it.copy(quote = null, mainBetReview = null, mainOddsAcceptedToken = null,
            busy = if (mainBetSubmitting) it.busy else false) }
    }
    fun showSlip(show: Boolean) = mutable.update {
        it.copy(showSlip = show, pickFlight = null)
    }
    fun showLogin(show: Boolean, register: Boolean = false) {
        if (!show) {
            pendingMfaSession = null
            pendingMfaFactor = null
        }
        mutable.update { it.copy(showLogin = show, registerScreen = register,
            mfaRequired = if (show) it.mfaRequired else false,
            mfaChoices = if (show) it.mfaChoices else emptyList(),
            selectedMfaFactor = if (show) it.selectedMfaFactor else null,
            authError = null) }
    }
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
            onMfaCompleted(navigateHome)
        } catch (ex: TotpChallengeRequired) {
            pendingMfaSession = ex.firstFactorSession
            pendingMfaFactor = ex.factors.firstOrNull()?.id
            pendingMfaNavigateHome = navigateHome
            mutable.update { it.copy(busy = false, mfaRequired = true,
                mfaChoices = ex.factors, selectedMfaFactor = pendingMfaFactor, authError = null) }
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
    private suspend fun onMfaCompleted(navigateHome: Boolean) {
            // Audit the newly authenticated device. A history service outage
            // must never convert a valid login into an authentication failure.
            runCatching {
                vault.accessToken(api)?.let { api.recordLogin88(it) }
            }
            sessionGeneration++
            quoteGeneration++
            mutable.update { it.copy(
                mainBetReview = null, mainOddsAcceptedToken = null, mainBetUncertain = false, quote = null,
                busy = false, showLogin = false, signedIn = true, mfaRequired = false,
                mfaChoices = emptyList(), selectedMfaFactor = null, authError = null,
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
    }

    /** Select another verified TOTP factor without changing or persisting AAL1 tokens. */
    fun chooseMfaFactor(id: String) {
        if (state.value.mfaChoices.none { it.id == id && it.verified }) return
        pendingMfaFactor = id
        mutable.update { it.copy(selectedMfaFactor = id, authError = null) }
    }

    fun verifyMfa(code: String) = viewModelScope.launch {
        if (state.value.busy) return@launch
        if (!code.matches(Regex("[0-9]{6}"))) {
            mutable.update { it.copy(authError = tr(it.lang,
                "Enter the six-digit authenticator code.", "کد شش‌رقمی برنامه امنیتی را وارد کنید.")) }
            return@launch
        }
        val firstFactor = pendingMfaSession
        val factor = pendingMfaFactor
        if (firstFactor == null || factor == null) {
            mutable.update { it.copy(mfaRequired = false, authError = tr(it.lang,
                "Sign in again to verify your code.", "برای تأیید کد دوباره وارد شوید.")) }
            return@launch
        }
        mutable.update { it.copy(busy = true, authError = null) }
        try {
            val elevated = api.mfaChallengeVerify(firstFactor.optString("access_token"), factor, code)
            vault.commitVerifiedMfaSession(elevated, api)
            pendingMfaSession = null
            pendingMfaFactor = null
            onMfaCompleted(pendingMfaNavigateHome)
        } catch (ex: Exception) {
            mutable.update { it.copy(busy = false, authError = tr(it.lang,
                "Authenticator code is invalid or expired. Try again.",
                "کد برنامه امنیتی نامعتبر یا منقضی است. دوباره امتحان کنید.")) }
        }
    }

    fun signOut() {
        pendingMfaSession = null
        pendingMfaFactor = null
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
            bonuses = emptyList(), quote = null, mainBetReview = null, mainOddsAcceptedToken = null,
            mainBetUncertain = false, showLogin = false,
            authError = null, accountLoading = false,
            betsPage = 1, betsHasMore = false, moreBetsLoading = false,
            historyQuery = BetHistoryQuery(), historyBets = emptyList(), historyPage = 1,
            historyHasMore = false, historyLoading = false,
            historyMoreLoading = false, historyError = null,
            moreWalletLoading = false,
            notifications = emptyList(), notificationPage = 1, notificationHasMore = false,
            notificationUnreadCount = 0, notificationError = null,
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

    fun refreshNotifications(more: Boolean = false, silent: Boolean = false) = viewModelScope.launch {
        val snapshot = state.value
        if (!snapshot.signedIn || snapshot.notificationLoading ||
            (more && (!snapshot.notificationHasMore || snapshot.notificationPage >= 1000))) return@launch
        val generation = sessionGeneration
        mutable.update { it.copy(notificationLoading = true, notificationError = null) }
        try {
            val jwt = vault.accessToken(api) ?: throw ApiFailure(401, "Authentication required")
            val page = api.notifications(jwt, if (more) snapshot.notificationPage + 1 else 1)
            val visible = page.items.filter { note ->
                notificationStillVisible(note.createdAt, System.currentTimeMillis())
            }
            if (generation == sessionGeneration && state.value.signedIn) mutable.update {
                it.copy(
                    notifications = if (more)
                        (it.notifications + visible)
                            .filter { n -> notificationStillVisible(n.createdAt, System.currentTimeMillis()) }
                            .distinctBy { n -> n.id } else visible,
                    notificationPage = page.page,
                    notificationHasMore = page.hasMore,
                    notificationUnreadCount = page.unreadCount,
                    notificationLoading = false,
                    notificationError = null
                )
            }
        } catch (ex: Exception) {
            if (generation == sessionGeneration) mutable.update {
                val text = tr(it.lang, "Could not load notifications.",
                    "دریافت اعلان‌ها ناموفق بود.")
                it.copy(notificationLoading = false, notificationError = text,
                    notice = if (silent) it.notice else text)
            }
        }
    }
    fun markNotificationRead(id: String) = viewModelScope.launch {
        val generation = sessionGeneration
        val jwt = vault.accessToken(api) ?: return@launch
        try {
            api.readNotifications(jwt, ids = listOf(id))
            if (generation == sessionGeneration && state.value.signedIn) mutable.update {
                val wasUnread = it.notifications.any { n -> n.id == id && n.readAt == null }
                it.copy(
                    notifications = it.notifications.map { note ->
                        if (note.id == id) note.copy(readAt = java.time.Instant.now().toString())
                        else note
                    },
                    notificationUnreadCount =
                        (it.notificationUnreadCount - if (wasUnread) 1 else 0).coerceAtLeast(0)
                )
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
                it.copy(
                    notifications = it.notifications.map { note ->
                        note.copy(readAt = note.readAt ?: java.time.Instant.now().toString())
                    },
                    notificationUnreadCount = 0
                )
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
    /**
     * Only prices a main-account bet. A second explicit action is necessary
     * to submit its signed token to the backend. No funds change here.
     */
    fun quote(stake: String) = viewModelScope.launch {
        val snapshot = state.value
        if (snapshot.busy || snapshot.mainBetUncertain || snapshot.picks.isEmpty()) return@launch
        val currency = snapshot.wallet?.currency?.uppercase()?.takeIf {
            it in setOf("USD", "IRR", "IRT")
        } ?: run {
            notice(tr(snapshot.lang, "Load your registered wallet before requesting a quote.",
                "ابتدا کیف پول حساب کاربری بارگذاری شود."))
            refreshAccount()
            return@launch
        }
        val minor = runCatching { mainBetStakeMinor(stake, currency) }.getOrElse {
            notice(tr(snapshot.lang, "Enter a valid stake for your wallet currency.",
                "مبلغ شرط را بر اساس ارز کیف پول معتبر وارد کنید."))
            return@launch
        }
        val selected = snapshot.picks.toList()
        val requestNumber = ++quoteGeneration
        val session = sessionGeneration
        val jwt = vault.accessToken(api) ?: run { showLogin(true); return@launch }
        mutable.update { it.copy(busy = true, quote = null, mainBetReview = null, mainOddsAcceptedToken = null) }
        try {
            val data = api.quote(jwt, selected, minor, currency)
            val payload = data.optJSONObject("quote")
                ?: throw ApiFailure(502, "Signed price quote missing")
            val review = parseMainBetReview(payload, minor, currency, selected, requestNumber)
            val wageringNow = runCatching { api.wageringAvailable() }.getOrDefault(false)
            if (requestNumber == quoteGeneration && session == sessionGeneration &&
                selected == state.value.picks &&
                state.value.wallet?.currency?.uppercase() == currency) {
                mutable.update {
                    it.copy(busy = false, mainBetReview = review, mainOddsAcceptedToken = null,
                        wageringEnabled = wageringNow,
                        quote = money(review.potentialPayoutMinor, currency))
                }
            }
        } catch (ex: Exception) {
            if (requestNumber == quoteGeneration && session == sessionGeneration) {
                val code = (ex as? ApiFailure)?.serverCode
                mutable.update {
                    it.copy(busy = false, quote = null, mainBetReview = null, mainOddsAcceptedToken = null,
                        notice = tr(it.lang,
                            "Official quote unavailable" + (code?.let { c -> " (" + c + ")" } ?: "") +
                                ". Select a market with fresh odds and try again.",
                            "استعلام رسمی قابل دریافت نیست؛ مارکت با ضریب تازه انتخاب کنید و دوباره تلاش کنید."))
                }
            }
        }
    }

    /**
     * Explicitly acknowledge the exact moved odds in one signed quote.
     * It must never submit the wager or debit funds.
     */
    fun acceptMainOddsChanges(stake: String) {
        val snapshot = state.value
        val review = snapshot.mainBetReview ?: return
        val currency = snapshot.wallet?.currency?.uppercase().orEmpty()
        val minor = runCatching { mainBetStakeMinor(stake, currency) }.getOrNull()
        if (!canAcceptChangedMainOdds(review, snapshot.picks, minor, currency,
                quoteGeneration)) {
            clearQuote()
            notice(tr(snapshot.lang, "Odds expired. Request a fresh quote.",
                "استعلام ضریب منقضی شده است؛ قیمت تازه دریافت کنید."))
            return
        }
        mutable.update {
            it.copy(mainOddsAcceptedToken = review.quoteToken, notice = null)
        }
    }

    /**
     * Read-only price heartbeat while the native slip is open. Poll at most
     * every 10 seconds, never mutate wallet/bets, never auto-accept or submit.
     * Do not replace an identical signed quote (which would erase consent).
     */
    fun pollMainOdds(stake: String) = viewModelScope.launch {
        val snapshot = state.value
        if (mainOddsPolling || mainBetSubmitting || snapshot.busy ||
            !snapshot.signedIn || snapshot.mainBetUncertain ||
            snapshot.mainOddsAcceptedToken != null || snapshot.picks.isEmpty()) return@launch
        val currency = snapshot.wallet?.currency?.uppercase()?.takeIf {
            it in setOf("USD", "IRR", "IRT")
        } ?: return@launch
        val minor = runCatching { mainBetStakeMinor(stake, currency) }.getOrNull()
            ?: return@launch
        val selected = snapshot.picks.toList()
        val startingGeneration = quoteGeneration
        val session = sessionGeneration
        mainOddsPolling = true
        try {
            val token = vault.accessToken(api) ?: return@launch
            val data = api.quote(token, selected, minor, currency)
            val body = data.optJSONObject("quote") ?: return@launch
            val next = parseMainBetReview(body, minor, currency, selected,
                startingGeneration)
            if (session != sessionGeneration || startingGeneration != quoteGeneration ||
                selected != state.value.picks ||
                state.value.mainOddsAcceptedToken != null ||
                state.value.wallet?.currency?.uppercase() != currency) return@launch
            val previous = state.value.mainBetReview
            if (previous == null || previous.changes != next.changes ||
                previous.potentialPayoutMinor != next.potentialPayoutMinor) {
                mutable.update {
                    it.copy(quote = money(next.potentialPayoutMinor, currency),
                        mainBetReview = next, mainOddsAcceptedToken = null)
                }
            }
        } catch (_: Exception) {
            // The last displayed odds are not thereby deemed tradable.
            // Explicit placement rechecks the official quote and market status.
        } finally {
            mainOddsPolling = false
        }
    }

    /**
     * Real-money submission. Only invoked by a second deliberate tap after
     * rendering the signed quote and each changed price. No automatic retry:
     * an ambiguous network response requires checking My Bets.
     */
    fun placeMainBet(stake: String) = viewModelScope.launch {
        // The public bootstrap is display-only; the authenticated API and
        // finance database still enforce all wagering preconditions.
        if (!state.value.wageringEnabled) {
            refreshWageringAvailability()
            notice(tr(state.value.lang, "Wagering is disabled by the server.",
                "ثبت شرط از طرف سرور غیرفعال است."))
            return@launch
        }
        val snapshot = state.value
        if (snapshot.busy || snapshot.mainBetUncertain || !snapshot.signedIn) return@launch
        val review = snapshot.mainBetReview ?: return@launch
        val currency = snapshot.wallet?.currency?.uppercase().orEmpty()
        val minor = runCatching { mainBetStakeMinor(stake, currency) }.getOrNull()
        if (!canConfirmMainBet(review, snapshot.picks, minor, currency, quoteGeneration,
                acceptedQuoteToken = snapshot.mainOddsAcceptedToken)) {
            clearQuote()
            notice(tr(snapshot.lang,
                "The official quote expired or your selections changed. Request a new quote.",
                "استعلام منقضی شده یا انتخاب‌ها تغییر کرده‌اند؛ دوباره استعلام بگیرید."))
            return@launch
        }
        if (mainBetSubmitting) return@launch
        // Acquire the one-shot lock *before* any suspending auth/network call.
        mainBetSubmitting = true
        val session = sessionGeneration
        mutable.update { it.copy(busy = true) }
        try {
            val jwt = vault.accessToken(api)
                ?: throw ApiFailure(401, "Session expired")
            api.placeMainBet(jwt, review.picks, review.stakeMinor, review.currency,
                review.quoteToken,
                review.changes.associate { it.selectionId to it.afterScaled },
                mainBetRequestId(review.quoteToken))
            if (session == sessionGeneration) {
                quoteGeneration++
                mutable.update {
                    it.copy(busy = false, quote = null, mainBetReview = null, mainOddsAcceptedToken = null,
                        picks = emptyList(), showSlip = false,
                        notice = tr(it.lang,
                            "Your bet was accepted. Check My Bets for its receipt.",
                            "شرط ثبت شد. رسید آن را در بخش شرط‌های من بررسی کنید."))
                }
                refreshAccount()
                refreshBetHistory()
            }
        } catch (ex: Exception) {
            if (session == sessionGeneration) {
                val response = ex as? ApiFailure
                val definiteRejection = response != null &&
                    response.code in 400..499 &&
                    response.code !in setOf(408, 429)
                quoteGeneration++
                mutable.update {
                    it.copy(busy = false, quote = null, mainBetReview = null, mainOddsAcceptedToken = null,
                        mainBetUncertain = !definiteRejection,
                        notice = if (definiteRejection)
                            tr(it.lang,
                                "Bet not accepted: " + (response?.serverCode ?: "QUOTE_REJECTED") +
                                    ". Refresh your selections and request a new quote.",
                                "شرط تأیید نشد. ضرایب را تازه کنید و دوباره استعلام بگیرید.")
                        else tr(it.lang,
                            "Bet status uncertain. Check My Bets or support before any new attempt.",
                            "وضعیت ثبت شرط نامشخص است؛ پیش از ارسال مجدد، شرط‌های من یا پشتیبانی را بررسی کنید."))
                }
                if (!definiteRejection) refreshBetHistory()
            }
        } finally {
            mainBetSubmitting = false
            if (session == sessionGeneration) mutable.update { it.copy(busy = false) }
        }
    }
}
