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
enum class Feature { NONE, PROFILE, BONUSES, VIP, SUPPORT, CASINO, AFFILIATE }
enum class Lang { EN, FA }

data class AppState(
    val tab: Tab = Tab.HOME, val feature: Feature = Feature.NONE,
    val lang: Lang = Lang.FA, val sport: String = "football",
    val live: List<Match> = emptyList(), val upcoming: List<Match> = emptyList(),
    val loading: Boolean = false, val detailLoading: Boolean = false,
    val liveEnabled: Boolean = false, val detail: Match? = null,
    val picks: List<Pick> = emptyList(), val showSlip: Boolean = false,
    val showLogin: Boolean = false, val signedIn: Boolean = false,
    val wallet: Wallet? = null, val bets: List<Bet> = emptyList(),
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
        val entry = Pick(match.id, market.id, selection.id, match.title,
            market.name, selection.name, selection.oddsScaled, selection.version, match.live)
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
    fun showSlip(show: Boolean) = mutable.update { it.copy(showSlip = show) }
    fun showLogin(show: Boolean) = mutable.update { it.copy(showLogin = show) }
    fun signIn(email: String, password: String) = viewModelScope.launch {
        mutable.update { it.copy(busy = true, notice = null) }
        try {
            vault.signIn(email, password, api)
            sessionGeneration++
            mutable.update { it.copy(busy = false, showLogin = false, signedIn = true) }
            refreshAccount()
        } catch (ex: Exception) {
            mutable.update { it.copy(busy = false, notice = ex.message ?: "Sign-in failed") }
        }
    }
    fun signOut() {
        sessionGeneration++
        vault.clear()
        mutable.update { it.copy(signedIn = false, wallet = null, bets = emptyList(),
            bonuses = emptyList(), quote = null, showLogin = false, accountLoading = false) }
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
                    bets = betResult.getOrNull() ?: it.bets,
                    bonuses = bonusResult.getOrNull() ?: it.bonuses,
                    accountLoading = false,
                    notice = if (walletResult.isFailure || betResult.isFailure || bonusResult.isFailure)
                        tr(it.lang, "Some account information could not be refreshed.",
                            "بخشی از اطلاعات حساب به‌روزرسانی نشد.") else it.notice
                )
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
