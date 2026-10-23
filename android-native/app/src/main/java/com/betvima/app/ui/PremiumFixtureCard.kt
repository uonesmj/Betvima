package com.betvima.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.betvima.app.data.Match
import com.betvima.app.data.Market
import com.betvima.app.data.Selection
import com.betvima.app.data.Team
import com.betvima.app.data.odds

private val fixtureInk = Color(0xFF202832)
private val fixtureSubtle = Color(0xFF798592)
private val fixtureStroke = Color(0xFFE2E7EC)
private val fixtureBlue = Color(0xFF087FF5)
private val fixtureGreen = Color(0xFF00C879)
private val fixtureRose = Color(0xFFE91F70)
private val fixtureCanvas = Color(0xFFF3F6F9)

/** The single native match-card system for search, home, live, upcoming and leagues.
 *
 * Both real-time and prematch display the SAME structure. The backend remains
 * authoritative about selection IDs, odds availability, scores and kick-off.
 */
@Composable
fun PremiumFixtureCard(
    match: Match,
    state: AppState,
    model: AppViewModel,
    modifier: Modifier = Modifier,
    onOpen: (String) -> Unit = { model.openMatch(it) }
) {
    val darkHome = LocalDarkHome.current
    val fixtureInk = if (darkHome) DarkHomePalette.ink else Color(0xFF202832)
    val fixtureSubtle = if (darkHome) DarkHomePalette.muted else Color(0xFF798592)
    val fixtureStroke = if (darkHome) DarkHomePalette.outline else Color(0xFFE2E7EC)
    val fixtureCanvas = if (darkHome) DarkHomePalette.soft else Color(0xFFF3F6F9)
    val fa = state.lang == Lang.FA
    val market = match.featured
    val accent = if (match.live) fixtureRose else fixtureGreen
    val liveClock = if (match.live) rememberVerifiedMatchClock(match) else ""
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(21.dp),
        border = BorderStroke(1.dp, fixtureStroke),
        color = if (darkHome) DarkHomePalette.panel else Color.White,
        shadowElevation = if (darkHome) 0.dp else 2.dp
    ) {
        Column {
            // Shared identity strip: not a different search vs upcoming design.
            Row(
                Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(
                        if (darkHome) listOf(Color(0xFF282A2E), DarkHomePalette.panel)
                        else listOf(Color(0xFFF1F7F9), Color(0xFFFCFDFE))))
                    .clickable { onOpen(match.id) }
                    .padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 7.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                LeagueIdentityBadge(match, size = 34)
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(match.league, color = fixtureInk, fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        CountryIdentity(match.country)
                        Text(match.country.takeIf { it.isNotBlank() }?.let(::countryDisplayName)
                            ?: tr(state.lang, "International", "بین‌المللی"),
                            color = fixtureSubtle, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("•", color = fixtureStroke, fontSize = 10.sp)
                        Text(match.sport.replace("-", " ").replaceFirstChar { it.uppercase() },
                            color = fixtureSubtle, fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold, maxLines = 1,
                            overflow = TextOverflow.Ellipsis)
                    }
                }
                Spacer(Modifier.width(4.dp))
                Surface(
                    color = if (match.live) Color(0xFFFFEAF2) else Color(0xFFE8F8F1),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (match.live) Icon(Icons.Default.Sensors, null,
                            tint = accent, modifier = Modifier.size(12.dp))
                        else Icon(Icons.Default.Event, null,
                            tint = accent, modifier = Modifier.size(12.dp))
                        Text(
                            if (match.live) tr(state.lang, "LIVE", "زنده")
                            else tr(state.lang, "PRE", "آینده"),
                            color = if (match.live) Color(0xFFC71961) else Color(0xFF008957),
                            fontWeight = FontWeight.Black, fontSize = 11.sp
                        )
                    }
                }
            }
            HorizontalDivider(color = fixtureStroke, thickness = .7.dp)
            Column(
                Modifier.fillMaxWidth().padding(start = 13.dp, end = 13.dp,
                    top = 7.dp, bottom = 9.dp),
                verticalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { onOpen(match.id) },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        if (match.live) Icons.Default.Sensors else Icons.Default.Schedule,
                        null, tint = accent, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Surface(color = fixtureCanvas, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            if (match.live) tr(state.lang, "In play", "در حال بازی") +
                                (if (liveClock == "—") "" else " · " + liveClock)
                            else searchKickoff(match.starts),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = fixtureInk, fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold, maxLines = 1
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    if (match.live && (match.homeScore != null || match.awayScore != null)) {
                        Text(tr(state.lang, "SCORE", "نتیجه"),
                            color = fixtureSubtle, fontWeight = FontWeight.ExtraBold, fontSize = 10.sp)
                    }
                }
                Column(
                    modifier = Modifier.fillMaxWidth().clickable { onOpen(match.id) },
                    verticalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    FixtureTeamLine(match.home, if (match.live) match.homeScore else null)
                    FixtureTeamLine(match.away, if (match.live) match.awayScore else null)
                }
                HorizontalDivider(color = fixtureStroke.copy(alpha = .7f), thickness = .7.dp)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        market?.label(fa) ?: tr(state.lang, "Odds unavailable", "ضریب موجود نیست"),
                        color = fixtureSubtle, fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f), maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(tr(state.lang, "ODDS", "ضرایب"), fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold, color = fixtureSubtle)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    repeat(3) { index ->
                        val selection = market?.selections?.getOrNull(index)
                        Box(Modifier.weight(1f)) {
                            if (market != null && selection != null)
                                PremiumFixtureOdd(match, market, selection, index, state, model) {
                                    onOpen(match.id)
                                }
                            else Box(Modifier.fillMaxWidth().height(45.dp)
                                .background(fixtureCanvas, RoundedCornerShape(10.dp))
                                .clickable { onOpen(match.id) },
                                contentAlignment = Alignment.Center) {
                                Text("—", color = fixtureSubtle, fontSize = 13.sp)
                            }
                        }
                    }
                    Surface(
                        modifier = Modifier.width(46.dp).height(45.dp)
                            .clickable { onOpen(match.id) },
                        color = if (darkHome) DarkHomePalette.blueSoft else Color(0xFFEAF3FF),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp,
                            if (darkHome) Color(0xFF285482) else Color(0xFFD4E5F8))
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(if (match.marketsCount > 0) "+${match.marketsCount}" else "›",
                                color = fixtureBlue, fontWeight = FontWeight.Black,
                                fontSize = 13.sp, maxLines = 1)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FixtureTeamLine(team: Team, score: Int?) {
    val darkHome = LocalDarkHome.current
    val fixtureInk = if (darkHome) DarkHomePalette.ink else Color(0xFF202832)
    val fixtureSubtle = if (darkHome) DarkHomePalette.muted else Color(0xFF798592)
    val fixtureStroke = if (darkHome) DarkHomePalette.outline else Color(0xFFE2E7EC)
    val fixtureCanvas = if (darkHome) DarkHomePalette.soft else Color(0xFFF3F6F9)
    Row(verticalAlignment = Alignment.CenterVertically) {
        TeamBadge(team, 23)
        Spacer(Modifier.width(7.dp))
        Text(
            team.name, color = fixtureInk,
            modifier = Modifier.weight(1f),
            fontSize = 14.sp, fontWeight = FontWeight.Black,
            maxLines = 1, overflow = TextOverflow.Ellipsis
        )
        if (score != null) {
            Surface(color = if (darkHome) DarkHomePalette.soft else Color(0xFFEDF1F5),
                shape = RoundedCornerShape(7.dp)) {
                Text(score.toString(), color = fixtureInk, fontWeight = FontWeight.Black,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
            }
        }
    }
}

@Composable
private fun PremiumFixtureOdd(
    match: Match, market: Market, selection: Selection, index: Int,
    state: AppState, model: AppViewModel, onOpen: () -> Unit
) {
    val darkHome = LocalDarkHome.current
    val fixtureInk = if (darkHome) DarkHomePalette.ink else Color(0xFF202832)
    val fixtureSubtle = if (darkHome) DarkHomePalette.muted else Color(0xFF798592)
    val fixtureStroke = if (darkHome) DarkHomePalette.outline else Color(0xFFE2E7EC)
    val fixtureCanvas = if (darkHome) DarkHomePalette.soft else Color(0xFFF3F6F9)
    val enabled = match.bettingAvailable && market.available &&
        selection.available && (!match.live || state.liveEnabled)
    val selected = state.picks.any { it.selectionId == selection.id }
    var oddCenter by remember(selection.id) { mutableStateOf(Offset.Unspecified) }
    val name = if (market.key == "h2h" && market.selections.size >= 3 && index < 3)
        listOf("1", "X", "2")[index]
    else NativeMarketLabels176.selection(state.lang, selection.label(false), selection.label(true))
    Surface(
        modifier = Modifier.fillMaxWidth().height(45.dp)
            .onGloballyPositioned { oddCenter = it.boundsInWindow().center }
            .clickable {
                // Suspended/display-only odds are never wagerable, but tapping
                // them must still navigate to this fixture's detail page.
                if (enabled) model.togglePick(match, market, selection,
                    oddCenter.x, oddCenter.y)
                else onOpen()
            },
        shape = RoundedCornerShape(10.dp),
        color = when {
            selected -> if (darkHome) DarkHomePalette.blueSoft else Color(0xFFE0EDFF)
            !enabled -> if (darkHome) Color(0xFF2B2D31) else Color(0xFFF2F3F6)
            selection.movement == "UP" -> if (darkHome) Color(0xFF19382E) else Color(0xFFEAF8F0)
            selection.movement == "DOWN" -> if (darkHome) Color(0xFF42252D) else Color(0xFFFFEFF0)
            else -> fixtureCanvas
        },
        border = BorderStroke(if (selected) 1.5.dp else 1.dp,
            if (selected) fixtureBlue else fixtureStroke)
    ) {
        Column(
            Modifier.fillMaxSize().padding(horizontal = 5.dp, vertical = 5.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(name, color = if (selected) fixtureBlue else fixtureSubtle,
                fontWeight = FontWeight.SemiBold, fontSize = 10.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center)
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!enabled) Icon(Icons.Default.Lock, null,
                    modifier = Modifier.size(13.dp), tint = fixtureSubtle)
                else {
                    if (selected) Icon(Icons.Default.Check, null,
                        modifier = Modifier.size(12.dp), tint = fixtureBlue)
                    Text(odds(selection.oddsScaled),
                        fontWeight = FontWeight.Black, fontSize = 15.sp,
                        color = if (selected) fixtureBlue else fixtureInk,
                        maxLines = 1)
                }
            }
        }
    }
}
