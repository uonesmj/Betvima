package com.betvima.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.Match
import kotlinx.coroutines.delay

/**
 * The same factual clock formatting for the Live catalogue and detail page.
 * TT=0 (including the half-time break) never ticks. No clock inferred from
 * kickoff time or the "LIVE" status. Limits extrapolation to 60 seconds while
 * waiting for a fresh provider sample.
 */
@Composable
internal fun rememberVerifiedMatchClock(match: Match, facts: LiveMatchFacts? = null): String {
    val activeFacts = facts?.takeIf {
        match.id.startsWith("betsapi:live:") &&
            match.id.substringAfterLast(':') == it.fi &&
            it.clockSeconds != null
    }
    val seconds = activeFacts?.clockSeconds ?: match.clockSeconds
    val ticking = if (activeFacts != null) activeFacts.clockRunning else match.clockRunning
    val observed = activeFacts?.observedAt ?: match.clockObservedAt
    var delta by remember(match.id, observed, seconds, ticking) { mutableIntStateOf(0) }
    LaunchedEffect(match.id, observed, seconds, ticking) {
        delta = 0
        if (match.live && seconds != null && ticking) {
            repeat(60) {
                delay(1_000)
                delta++
            }
        }
    }
    val total = seconds?.let { it + delta }
    return when {
        total != null -> (total / 60).toString() + ":" +
            (total % 60).toString().padStart(2, '0')
        match.minute != null -> match.minute.toString() + "′"
        else -> "—"
    }
}
