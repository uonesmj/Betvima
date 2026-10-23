package com.betvima.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.LiveStat
import com.betvima.app.data.Match

internal val premiumBackground130 = Color(0xFF08151F)
internal val premiumPanel130 = Color(0xFF102834)
internal val premiumLine130 = Color(0xFF274452)
internal val premiumMint130 = Color(0xFF4BF3B6)
internal val premiumAmber130 = Color(0xFFFFCF83)
internal val premiumText130 = Color(0xFFF2FFF9)
internal val premiumMuted130 = Color(0xFFA7C4CA)

internal data class PressureSample130(val id: String, val homeRatio: Float, val minute: Int?)

internal fun pressureRatio130(facts: LiveMatchFacts?): Float? {
    val metric = facts?.stat("dangerous_attacks") ?: facts?.stat("attacks") ?: return null
    val home = metric.home ?: return null
    val away = metric.away ?: return null
    if (home < 0 || away < 0) return null
    val total = home.toLong() + away
    return if (total == 0L) null else (home.toFloat() / total).coerceIn(0f, 1f)
}

private val importantStats130 = listOf(
    "dangerous_attacks", "on_target", "off_target", "possession", "corners",
    "attacks", "fouls", "offsides", "yellowcards", "redcards",
    "throwins", "freekicks", "goalkicks", "penalties"
)

@Composable
internal fun PremiumPressureBar130(
    ratio: Float?, modifier: Modifier = Modifier, fa: Boolean = false, caption: Boolean = false
) {
    val activeLang177 = LocalNativeLanguage176.current
    val home by animateFloatAsState(targetValue = ratio ?: .5f,
        animationSpec = tween(850), label = "pressure130")
    Column(modifier, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        if (caption) Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(tr(activeLang177, "REPORTED ATTACKING PRESSURE", "فشار حملات ثبت‌شده"),
                modifier = Modifier.weight(1f), color = premiumMuted130,
                fontSize = 8.sp, fontWeight = FontWeight.ExtraBold)
            Text(if (ratio == null) "—" else
                (home * 100).toInt().toString() + " : " + (100 - (home * 100).toInt()),
                fontSize = 9.sp, color = premiumText130, fontWeight = FontWeight.Bold)
        }
        Row(Modifier.fillMaxWidth().height(8.dp)
            .background(Color(0xFF254452), RoundedCornerShape(9.dp))) {
            if (ratio != null) {
                Box(Modifier.weight(home.coerceAtLeast(.001f)).fillMaxHeight()
                    .background(Brush.horizontalGradient(
                        listOf(Color(0xFF198E75), premiumMint130)),
                        RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp)))
                Spacer(Modifier.width(2.dp))
                Box(Modifier.weight((1f - home).coerceAtLeast(.001f)).fillMaxHeight()
                    .background(Brush.horizontalGradient(
                        listOf(premiumAmber130, Color(0xFFB76E35))),
                        RoundedCornerShape(topEnd = 8.dp, bottomEnd = 8.dp)))
            }
        }
    }
}

@Composable
private fun PremiumMetric130(stat: LiveStat, fa: Boolean) {
    val activeLang177 = LocalNativeLanguage176.current
    val h = stat.home
    val a = stat.away
    val total = (h ?: 0).toLong() + (a ?: 0)
    val share = if (h == null || a == null || h < 0 || a < 0 || total <= 0L)
        null else h.toFloat() / total
    val pct by animateFloatAsState(share ?: .5f, animationSpec = tween(650),
        label = "metric130")
    Column(Modifier.fillMaxWidth()
        .background(Color(0xFF112E38), RoundedCornerShape(11.dp))
        .border(.5.dp, premiumLine130, RoundedCornerShape(11.dp))
        .padding(horizontal = 9.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text((h ?: "—").toString(), color = premiumMint130,
                fontSize = 12.sp, fontWeight = FontWeight.Black)
            Text(tr(activeLang177, stat.en, stat.fa), modifier = Modifier.weight(1f),
                fontSize = 9.sp, color = premiumText130, fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text((a ?: "—").toString(), color = premiumAmber130,
                fontSize = 12.sp, fontWeight = FontWeight.Black)
        }
        Canvas(Modifier.fillMaxWidth().height(4.dp)) {
            val gap = 2.dp.toPx()
            drawRoundRect(Color(0xFF294751), cornerRadius = CornerRadius(size.height / 2))
            if (share != null) {
                val w = size.width * pct
                if (w > gap) drawRoundRect(premiumMint130,
                    size = Size(w - gap, size.height),
                    cornerRadius = CornerRadius(size.height / 2))
                val b = (size.width - w - gap).coerceAtLeast(0f)
                if (b > 0f) drawRoundRect(premiumAmber130,
                    topLeft = Offset(w + gap, 0f), size = Size(b, size.height),
                    cornerRadius = CornerRadius(size.height / 2))
            }
        }
    }
}

@Composable
internal fun PremiumStatistics130(
    facts: LiveMatchFacts?, fa: Boolean, cue: LiveIncidentCue129?, match: Match
) {
    val activeLang177 = LocalNativeLanguage176.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
        .padding(horizontal = 9.dp, vertical = 9.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)) {
        IncidentStatsCue129(cue, match, fa)
        val available = importantStats130.mapNotNull { facts?.stat(it) }
        if (available.isEmpty()) {
            PremiumNoData130(tr(activeLang177, "Waiting for verified live match statistics.", "آمار معتبر مسابقه هنوز دریافت نشده."))
        } else available.forEach { PremiumMetric130(it, fa) }
    }
}

@Composable
internal fun PremiumMomentum130(
    samples: List<PressureSample130>, facts: LiveMatchFacts?, fa: Boolean
) {
    val activeLang177 = LocalNativeLanguage176.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
        .padding(10.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(tr(activeLang177, "ATTACKING PRESSURE", "روند فشار حملات"),
            color = premiumText130, fontWeight = FontWeight.Black, fontSize = 11.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(6.dp).background(premiumMint130, RoundedCornerShape(2.dp)))
            Text(tr(activeLang177, "Home", "میزبان"), color = premiumMuted130, fontSize = 9.sp)
            Spacer(Modifier.width(10.dp))
            Box(Modifier.size(6.dp).background(premiumAmber130, RoundedCornerShape(2.dp)))
            Text(tr(activeLang177, "Away", "مهمان"), color = premiumMuted130, fontSize = 9.sp)
        }
        if (samples.size < 2) {
            PremiumNoData130(tr(activeLang177, "The trend builds from new provider snapshots in this session.", "نمودار پس از دریافت چند به‌روزرسانی واقعی ساخته می‌شود."))
        } else Canvas(Modifier.fillMaxWidth().height(104.dp)
            .background(Color(0xFF12333D), RoundedCornerShape(11.dp))
            .padding(9.dp)) {
            drawLine(Color.White.copy(alpha = .12f),
                Offset(0f, size.height / 2), Offset(size.width, size.height / 2),
                strokeWidth = 1.dp.toPx())
            val width = size.width / samples.size.toFloat()
            samples.forEachIndexed { i, entry ->
                val ratio = entry.homeRatio.coerceIn(0f, 1f)
                val x = i * width + width * .15f
                val w = width * .7f
                val topHeight = ratio * (size.height / 2)
                val bottomHeight = (1f - ratio) * (size.height / 2)
                if (topHeight > 0f) drawRoundRect(
                    premiumMint130.copy(alpha = .88f),
                    topLeft = Offset(x, size.height / 2 - topHeight),
                    size = Size(w, topHeight), cornerRadius = CornerRadius(3f))
                if (bottomHeight > 2f) drawRoundRect(
                    premiumAmber130.copy(alpha = .84f),
                    topLeft = Offset(x, size.height / 2 + 2f),
                    size = Size(w, bottomHeight - 2f), cornerRadius = CornerRadius(3f))
            }
        }
        PremiumPressureBar130(pressureRatio130(facts), caption = true, fa = fa)
        Text(tr(activeLang177, "Observed attack-counter shares during this visit; not actual ball tracking.", "نمودار بر اساس تغییر شمارندهٔ حملات در طول بازدید است، نه موقعیت توپ."),
            color = premiumMuted130, fontSize = 8.sp, lineHeight = 11.sp)
    }
}

@Composable
private fun PremiumEventMark130(kind: IncidentKind129) {
    val tone = when (kind) {
        IncidentKind129.GOAL, IncidentKind129.ATTACK,
        IncidentKind129.DANGEROUS_ATTACK -> premiumMint130
        IncidentKind129.RED_CARD -> Color(0xFFFF6579)
        IncidentKind129.SHOT_ON, IncidentKind129.SHOT_OFF,
        IncidentKind129.CORNER, IncidentKind129.PENALTY,
        IncidentKind129.YELLOW_CARD -> premiumAmber130
        else -> premiumMuted130
    }
    val icon = when (kind) {
        IncidentKind129.CORNER -> Icons.Default.Flag
        IncidentKind129.FOUL, IncidentKind129.OFFSIDE,
        IncidentKind129.YELLOW_CARD, IncidentKind129.RED_CARD -> Icons.Default.Warning
        IncidentKind129.ATTACK, IncidentKind129.DANGEROUS_ATTACK -> Icons.Default.Bolt
        else -> Icons.Default.SportsSoccer
    }
    Box(Modifier.size(28.dp).background(tone.copy(alpha = .12f), RoundedCornerShape(9.dp)),
        contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = tone, modifier = Modifier.size(16.dp))
    }
}

@Composable
internal fun PremiumEvents130(
    entries: List<LiveIncidentCue129>, match: Match, fa: Boolean
) {
    val activeLang177 = LocalNativeLanguage176.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
        .padding(horizontal = 9.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(tr(activeLang177, "OBSERVED MATCH UPDATES", "تغییرات ثبت‌شده در این بازدید"),
            color = premiumMuted130, fontSize = 9.sp, fontWeight = FontWeight.Black)
        if (entries.isEmpty()) PremiumNoData130(tr(activeLang177, "New confirmed changes will appear here.", "هنوز تغییر جدیدی دریافت نشده است."))
        else entries.take(18).forEach { cue ->
            Row(Modifier.fillMaxWidth()
                .background(Color(0xFF13313B), RoundedCornerShape(11.dp))
                .border(.5.dp, premiumLine130, RoundedCornerShape(11.dp))
                .padding(7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                PremiumEventMark130(cue.kind)
                Column(Modifier.weight(1f)) {
                    Text(incidentCaption129(cue.kind, fa), color = premiumText130,
                        fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(if (cue.side == IncidentSide129.HOME)
                        match.home.name else match.away.name,
                        color = premiumMuted130, fontSize = 9.sp, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(cue.minute?.toString()?.plus("′") ?: "LIVE", color = premiumMint130,
                        fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(if (cue.confirmedScore) (tr(activeLang177, "Score", "نتیجه"))
                        else "+" + cue.amount, color = premiumMuted130, fontSize = 8.sp)
                }
            }
        }
        Text(tr(activeLang177, "Provider counter changes, not officially timestamped incident records.", "تغییرات شمارنده‌های API؛ زمان وقوع دقیق رویدادها تأیید نشده است."),
            color = premiumMuted130, fontSize = 8.sp, lineHeight = 11.sp)
    }
}

@Composable
private fun PremiumNoData130(value: String) {
    Surface(modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp), color = Color(0xFF15313B)) {
        Column(Modifier.padding(vertical = 18.dp, horizontal = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.BarChart, null, tint = premiumMuted130,
                modifier = Modifier.size(19.dp))
            Spacer(Modifier.height(5.dp))
            Text(value, color = premiumMuted130, fontSize = 10.sp,
                textAlign = TextAlign.Center)
        }
    }
}
