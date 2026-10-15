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
import androidx.compose.runtime.Composable
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
    val fa = state.lang == Lang.FA
    val market = match.featured
    val accent = if (match.live) fixtureRose else fixtureGreen
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(21.dp),
        border = BorderStroke(1.dp, fixtureStroke),
        color = Color.White,
        shadowElevation = 2.dp
    ) {
        Column {
            // Shared identity strip: not a different search vs upcoming design.
            Row(
                Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(
                        listOf(Color(0xFFF1F7F9), Color(0xFFFCFDFE))))
                    .clickable { onOpen(match.id) }
                    .padding(start = 12.dp, end = 12.dp, top = 11.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                LeagueIdentityBadge(match, size = 41)
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(match.league, color = fixtureInk, fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        CountryIdentity(match.country)
                        Text(match.country.takeIf { it.isNotBlank() }?.let(::countryDisplayName)
                            ?: tr(state.lang, "International", "بین‌المللی"),
                            color = fixtureSubtle, fontSize = 9.sp, maxLines = 1,
                            overflow = TextOverflow.Ellipsis)
                        Text("•", color = fixtureStroke, fontSize = 10.sp)
                        Text(match.sport.replace("-", " ").replaceFirstChar { it.uppercase() },
                            color = fixtureSubtle, fontSize = 10.sp, maxLines = 1,
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
                            fontWeight = FontWeight.Black, fontSize = 10.sp
                        )
                    }
                }
            }
            HorizontalDivider(color = fixtureStroke, thickness = .7.dp)
            Column(
                Modifier.fillMaxWidth().padding(start = 13.dp, end = 13.dp,
                    top = 10.dp, bottom = 13.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
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
                                (match.minute?.let { " · ${it}′" } ?: "")
                            else searchKickoff(match.starts),
                            modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp),
                            color = fixtureInk, fontSize = 11.sp,
                            fontWeight = FontWeight.Bold, maxLines = 1
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    if (match.live && (match.homeScore != null || match.awayScore != null)) {
                        Text(tr(state.lang, "SCORE", "نتیجه"),
                            color = fixtureSubtle, fontWeight = FontWeight.Bold, fontSize = 9.sp)
                    }
                }
                Column(
                    modifier = Modifier.fillMaxWidth().clickable { onOpen(match.id) },
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FixtureTeamLine(match.home, if (match.live) match.homeScore else null)
                    FixtureTeamLine(match.away, if (match.live) match.awayScore else null)
                }
                HorizontalDivider(color = fixtureStroke.copy(alpha = .7f), thickness = .7.dp)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        market?.label(fa) ?: tr(state.lang, "Odds unavailable", "ضریب موجود نیست"),
                        color = fixtureSubtle, fontSize = 11.sp,
                        modifier = Modifier.weight(1f), maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(tr(state.lang, "ODDS", "ضرایب"), fontSize = 9.sp,
                        fontWeight = FontWeight.Bold, color = fixtureSubtle)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    repeat(3) { index ->
                        val selection = market?.selections?.getOrNull(index)
                        Box(Modifier.weight(1f)) {
                            if (market != null && selection != null)
                                PremiumFixtureOdd(match, market, selection, index, state, model)
                            else Box(Modifier.fillMaxWidth().height(53.dp)
                                .background(fixtureCanvas, RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center) {
                                Text("—", color = fixtureSubtle, fontSize = 13.sp)
                            }
                        }
                    }
                    Surface(
                        modifier = Modifier.width(46.dp).height(53.dp)
                            .clickable { onOpen(match.id) },
                        color = Color(0xFFEAF3FF),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, Color(0xFFD4E5F8))
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(if (match.marketsCount > 0) "+${match.marketsCount}" else "›",
                                color = fixtureBlue, fontWeight = FontWeight.Black,
                                fontSize = 12.sp, maxLines = 1)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FixtureTeamLine(team: Team, score: Int?) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        TeamBadge(team, 27)
        Spacer(Modifier.width(8.dp))
        Text(
            team.name, color = fixtureInk,
            modifier = Modifier.weight(1f),
            fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
            maxLines = 1, overflow = TextOverflow.Ellipsis
        )
        if (score != null) {
            Surface(color = Color(0xFFEDF1F5), shape = RoundedCornerShape(7.dp)) {
                Text(score.toString(), color = fixtureInk, fontWeight = FontWeight.Black,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
            }
        }
    }
}

@Composable
private fun PremiumFixtureOdd(
    match: Match, market: Market, selection: Selection, index: Int,
    state: AppState, model: AppViewModel
) {
    val enabled = match.bettingAvailable && market.available &&
        selection.available && (!match.live || state.liveEnabled)
    val selected = state.picks.any { it.selectionId == selection.id }
    val name = if (market.key == "h2h" && market.selections.size >= 3 && index < 3)
        listOf("1", "X", "2")[index]
    else selection.label(state.lang == Lang.FA)
    Surface(
        modifier = Modifier.fillMaxWidth().height(53.dp)
            .clickable(enabled = enabled) { model.togglePick(match, market, selection) },
        shape = RoundedCornerShape(10.dp),
        color = when {
            selected -> Color(0xFFE0EDFF)
            !enabled -> Color(0xFFF2F3F6)
            selection.movement == "UP" -> Color(0xFFEAF8F0)
            selection.movement == "DOWN" -> Color(0xFFFFEFF0)
            else -> fixtureCanvas
        },
        border = BorderStroke(if (selected) 1.5.dp else 1.dp,
            if (selected) fixtureBlue else Color(0xFFE9EDF2))
    ) {
        Column(
            Modifier.fillMaxSize().padding(horizontal = 5.dp, vertical = 5.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(name, color = if (selected) fixtureBlue else fixtureSubtle,
                fontWeight = FontWeight.Medium, fontSize = 9.sp,
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
                        fontWeight = FontWeight.Black, fontSize = 14.sp,
                        color = if (selected) fixtureBlue else fixtureInk,
                        maxLines = 1)
                }
            }
        }
    }
}
