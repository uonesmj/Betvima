package com.betvima.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowOutward
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.Match

/**
 * Read-only, premium fixture summary. This card changes presentation only;
 * no betting selections, quote permissions, or external facts are modified.
 */
@Composable
internal fun PremiumMatchScoreHeader126(
    match: Match,
    facts: LiveMatchFacts?,
    fa: Boolean,
    clockLabel: String,
    onOpenStudio: () -> Unit
) {
    val activeLang177 = LocalNativeLanguage176.current
    val score = facts?.score?.split("-")?.takeIf { it.size == 2 }
        ?.joinToString(" : ")
        ?: if (match.homeScore != null && match.awayScore != null)
            match.homeScore.toString() + " : " + match.awayScore.toString() else "VS"
    Surface(
        color = Color.Black,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, Color(0xFF333333)),
        shadowElevation = 7.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(Modifier.background(Color.Black)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 15.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(7.dp).background(if (match.live)
                        Color(0xFF35E7A1) else Color(0xFF96A6AB),
                        RoundedCornerShape(5.dp)))
                    Spacer(Modifier.width(7.dp))
                    Text(if (match.live) "LIVE  ·  " + clockLabel
                        else trLive177(activeLang177, "UPCOMING", "پیش از شروع"),
                        color = Color(0xFFAAFBDD), fontSize = 11.sp,
                        fontWeight = FontWeight.Black)
                }
                Text(trLive177(activeLang177, "MATCH SCORE", "نتیجه رسمی"),
                    color = Color(0xFFA6C4BC), fontSize = 9.sp,
                    fontWeight = FontWeight.ExtraBold)
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    TeamBadge(match.home, 58)
                    Spacer(Modifier.height(9.dp))
                    Text(match.home.name, textAlign = TextAlign.Center,
                        fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                        color = Color.White, maxLines = 2, lineHeight = 17.sp,
                        overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(4.dp))
                    Text(trLive177(activeLang177, "HOME", "میزبان"),
                        color = Color(0xFFA4BDBC), fontSize = 9.sp)
                }
                Column(Modifier.width(100.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    AnimatedContent(targetState = score,
                        transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(220)) },
                        label = "scoreCard126") { current ->
                        Text(current, color = Color.White, fontWeight = FontWeight.Black,
                            fontSize = 26.sp, maxLines = 1)
                    }
                    Surface(shape = RoundedCornerShape(10.dp),
                        color = Color(0xFF151515),
                        border = BorderStroke(1.dp, Color(0xFF404040))) {
                        Text(if (match.live) clockLabel else "PRE",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = Color(0xFFB7FFE0), fontSize = 10.sp,
                            fontWeight = FontWeight.Black)
                    }
                }
                Column(Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    TeamBadge(match.away, 58)
                    Spacer(Modifier.height(9.dp))
                    Text(match.away.name, textAlign = TextAlign.Center,
                        fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                        color = Color.White, maxLines = 2, lineHeight = 17.sp,
                        overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(4.dp))
                    Text(trLive177(activeLang177, "AWAY", "مهمان"),
                        color = Color(0xFFA4BDBC), fontSize = 9.sp)
                }
            }
            Spacer(Modifier.height(15.dp))
            HorizontalDivider(color = Color.White.copy(alpha = .1f))
            Row(Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(match.league, color = Color(0xFFEAF6F1), fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold, maxLines = 1,
                        overflow = TextOverflow.Ellipsis)
                    Text(trLive177(activeLang177, "Provider-confirmed match data", "داده‌های تأییدشده مسابقه"),
                        fontSize = 9.sp, color = Color(0xFF9ABDB6))
                }
                if (match.live) Surface(
                    modifier = Modifier.clickable(onClick = onOpenStudio),
                    color = Color(0xFF2EDF9C), shape = RoundedCornerShape(12.dp)
                ) {
                    Row(Modifier.padding(horizontal = 11.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Tv, null, tint = Color(0xFF06311E),
                            modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(5.dp))
                        Text(trLive177(activeLang177, "LIVE TV", "TV زنده"),
                            color = Color(0xFF06311E), fontSize = 10.sp,
                            fontWeight = FontWeight.Black)
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Default.ArrowOutward, null, tint = Color(0xFF06311E),
                            modifier = Modifier.size(13.dp))
                    }
                }
            }
        }
    }
}
