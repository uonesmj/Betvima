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
import java.math.BigDecimal
import java.math.RoundingMode

enum class Tab { HOME, LIVE, SPORTS, BETS, WALLET }
enum class Feature { NONE, PROFILE, BONUSES, VIP, SUPPORT, CASINO, AFFILIATE, NOTIFICATIONS }
enum class Lang { EN, FA }

data class AppState(
    val tab: Tab = Tab.HOME, val feature: Feature = Feature.NONE,
    val lang: Lang = Lang.FA, val sport: String = "football",
    val live: List<Match> = emptyList(), val upcoming: List<Match> = emptyList(),
    val loading: Boolean = false, val detailLoading: Boolean = false,
    val liveEnabled: Boolean = false, val detail: Match? = null,
    val betDetail: BetDetail? = null, val betDetailLoading: Boolean = false,
    val betDetailVisible: Boolean = false,
    val picks: List<Pick> = emptyList(), val showSlip: Boolean = false,
    val showLogin: Boolean = false, val signedIn: Boolean = false,
    val wallet: Wallet? = null, val bets: List<Bet> = emptyList(),
    val betsPage: Int = 1, val betsHasMore: Boolean = false,
    val moreBetsLoading: Boolean = false, val moreWalletLoading: Boolean = false,
    val notifications: List<UserNotification> = emptyList(),
    val notificationPage: Int = 1, val notificationHasMore: Boolean = false,
    val notificationLoading: Boolean = false,
    val bonuses: List<Bonus> = emptyList(), val busy: Boolean = false,
    val accountLoading: Boolean = false,
    val quote: String? = null, val notice: String? = null
)

/** Screen state lives outside composables; every value comes from BetVima API. */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient()
    private val vault = SessionVault(app)
    private val preferences = app.getSharedPreferences("native_preferences", android.content.Context.MODE_PRIVATE)
    private var sessionGeneration = 0
    private val mutable = MutableStateFlow(AppState(
        signedIn = vault.signedIn(),
        lang = if (preferences.getString("language", "fa") == "en") Lang.EN else Lang.FA
    ))
    val state = mutable.asStateFlow()
    init {
        refreshAll()
        if (vault.signedIn()) refreshAccount()
    }
    fun notice(message: String?) = mutable.update { it.copy(notice = message) }
    fun language() {
        val lang = if (state.value.lang == Lang.EN) Lang.FA else Lang.EN
        preferences.edit().putString("language", if (lang == Lang.FA) "fa" else "en").apply()
        mutable.update { it.copy(lang = lang) }
    }
    fun tab(tab: Tab) {
        mutable.update { it.copy(tab = tab, feature = Feature.NONE, detail = null) }
        when (tab) {
            Tab.LIVE -> refreshLive()
            Tab.SPORTS -> refreshUpcoming()
            Tab.BETS, Tab.WALLET -> if (state.value.signedIn) refreshAccount()
            else -> Unit
        }
    }
    fun feature(feature: Feature) {
        mutable.update { it.copy(feature = feature, detail = null) }
        if (feature == Feature.BONUSES && state.value.signedIn) refreshAccount()
        if (feature == Feature.NOTIFICATIONS && state.value.signedIn) refreshNotifications()
    }
    fun sport(sport: String) {
        mutable.update { it.copy(sport = sport) }
        refreshUpcoming()
    }
    fun refreshAll() {
        refreshLive()
        refreshUpcoming()
    }
    fun refreshLive(silent: Boolean = false) = viewModelScope.launch {
        if (!silent) mutable.update { it.copy(loading = true) }
        try {
            val (matches, liveEnabled) = api.live()
            mutable.update { it.copy(live = matches, liveEnabled = liveEnabled, loading = false) }
        } catch (ex: Exception) {
            mutable.update { it.copy(loading = false, notice = if (silent) it.notice else
                ex.message ?: "Live data unavailable") }
        }
    }
    fun refreshUpcoming() = viewModelScope.launch {
        mutable.update { it.copy(loading = true) }
        try {
            val events = api.upcoming(state.value.sport)
            mutable.update { it.copy(upcoming = events, loading = false) }
        } catch (ex: Exception) {
            mutable.update { it.copy(loading = false, notice = ex.message ?: "Unable to load fixtures") }
        }
    }
    fun openMatch(id: String) = viewModelScope.launch {
        mutable.update { it.copy(detailLoading = true, detail = null) }
        try {
            val match = api.detail(id)
            mutable.update { it.copy(detail = match, detailLoading = false) }
        } catch (ex: Exception) {
            mutable.update { it.copy(detailLoading = false, notice = ex.message ?: "Match unavailable") }
        }
    }
    fun closeMatch() = mutable.update { it.copy(detail = null, detailLoading = false) }
    fun togglePick(match: Match, market: Market, selection: Selection) {
        if (!match.bettingAvailable || !market.available || !selection.available ||
            (match.live && !state.value.liveEnabled)) return
        val persian = state.value.lang == Lang.FA
        val entry = Pick(match.id, market.id, selection.id, match.title,
            market.label(persian), selection.label(persian),
            selection.oddsScaled, selection.version, match.live)
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
    fun removePick(id: String) = mutable.update {
        val picks = it.picks.filterNot { p -> p.selectionId == id }
        it.copy(picks = picks, quote = null, showSlip = picks.isNotEmpty())
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
    fun showSlip(show: Boolean) = mutable.update { it.copy(showSlip = show) }
    fun showLogin(show: Boolean) = mutable.update { it.copy(showLogin = show) }
    fun signIn(email: String, password: String) = viewModelScope.launch {
        mutable.update { it.copy(busy = true, notice = null) }
        try {
            vault.signIn(email, password, api)
            sessionGeneration++
            mutable.update { it.copy(busy = false, showLogin = false, signedIn = true) }
            refreshAccount()
            if (state.value.feature == Feature.NOTIFICATIONS) refreshNotifications()
        } catch (ex: Exception) {
            mutable.update { it.copy(busy = false, notice = ex.message ?: "Sign-in failed") }
        }
    }
    fun signOut() {
        closeBet()
        sessionGeneration++
        vault.clear()
        mutable.update { it.copy(signedIn = false, wallet = null, bets = emptyList(),
            bonuses = emptyList(), quote = null, showLogin = false, accountLoading = false,
            betsPage = 1, betsHasMore = false, moreBetsLoading = false, moreWalletLoading = false,
            notifications = emptyList(), notificationPage = 1, notificationHasMore = false,
            notificationLoading = false) }
    }
    fun refreshAccount() = viewModelScope.launch {
        if (!state.value.signedIn) return@launch
        val generation = sessionGeneration
        mutable.update { it.copy(accountLoading = true) }
        val jwt = vault.accessToken(api)
        if (jwt.isNullOrBlank()) {
            if (sessionGeneration == generation) {
                mutable.update { it.copy(accountLoading = false,
                    notice = tr(it.lang, "Your session could not be refreshed. Please sign in again.",
                        "نشست شما تمدید نشد. لطفاً دوباره وارد شوید.")) }
            }
            return@launch
        }
        supervisorScope {
            // A temporary error in a single service must not erase confirmed wallet data.
            val wallet = async { runCatching { api.wallet(jwt) } }
            val bets = async { runCatching { api.bets(jwt) } }
            val bonuses = async { runCatching { api.bonuses(jwt) } }
            val walletResult = wallet.await()
            val betResult = bets.await()
            val bonusResult = bonuses.await()
            if (sessionGeneration != generation || !state.value.signedIn) return@supervisorScope
            mutable.update {
                it.copy(
                    wallet = walletResult.getOrNull() ?: it.wallet,
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
            val result = api.quote(jwt, state.value.picks, cents).optJSONObject("quote")
            val payout = result?.optString("potentialPayoutMinor").orEmpty()
            mutable.update { it.copy(busy = false, quote =
                if (payout.isNotBlank()) money(payout, "USD") else null) }
        } catch (ex: Exception) {
            mutable.update { it.copy(busy = false, notice = ex.message ?: "Quote unavailable") }
        }
    }
}
