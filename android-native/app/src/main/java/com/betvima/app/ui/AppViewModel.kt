package com.betvima.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.betvima.app.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.RoundingMode

enum class Tab { HOME, LIVE, SPORTS, BETS, WALLET }
enum class Feature { NONE, BONUSES, VIP, SUPPORT, CASINO, AFFILIATE }
enum class Lang { EN, FA }

data class AppState(
    val tab: Tab = Tab.HOME, val feature: Feature = Feature.NONE,
    val lang: Lang = Lang.EN, val sport: String = "football",
    val live: List<Match> = emptyList(), val upcoming: List<Match> = emptyList(),
    val loading: Boolean = false, val detailLoading: Boolean = false,
    val liveEnabled: Boolean = false, val detail: Match? = null,
    val picks: List<Pick> = emptyList(), val showSlip: Boolean = false,
    val showLogin: Boolean = false, val signedIn: Boolean = false,
    val wallet: Wallet? = null, val bets: List<Bet> = emptyList(),
    val bonuses: List<Bonus> = emptyList(), val busy: Boolean = false,
    val quote: String? = null, val notice: String? = null
)

/** Screen state lives outside composables; every value comes from BetVima API. */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient()
    private val vault = SessionVault(app)
    private val mutable = MutableStateFlow(AppState(signedIn = vault.signedIn()))
    val state = mutable.asStateFlow()
    init {
        refreshAll()
        if (vault.signedIn()) refreshAccount()
    }
    fun notice(message: String?) = mutable.update { it.copy(notice = message) }
    fun language() = mutable.update { it.copy(lang = if (it.lang == Lang.EN) Lang.FA else Lang.EN) }
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
            mutable.update { it.copy(busy = false, showLogin = false, signedIn = true) }
            refreshAccount()
        } catch (ex: Exception) {
            mutable.update { it.copy(busy = false, notice = ex.message ?: "Sign-in failed") }
        }
    }
    fun signOut() {
        vault.clear()
        mutable.update { it.copy(signedIn = false, wallet = null, bets = emptyList(),
            bonuses = emptyList(), quote = null, showLogin = false) }
    }
    fun refreshAccount() = viewModelScope.launch {
        val jwt = vault.accessToken(api) ?: run {
            mutable.update { it.copy(wallet = null, bets = emptyList(), bonuses = emptyList(),
                notice = "Please sign in again") }
            return@launch
        }
        try {
            val wallet = api.wallet(jwt)
            val bets = api.bets(jwt)
            val bonuses = api.bonuses(jwt)
            mutable.update { it.copy(wallet = wallet, bets = bets, bonuses = bonuses) }
        } catch (ex: Exception) {
            mutable.update { it.copy(wallet = null, bets = emptyList(), bonuses = emptyList(),
                notice = ex.message ?: "Account data unavailable") }
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
