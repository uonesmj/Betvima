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
import java.time.Instant

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
    // When the user opens a match from a card, that card snapshot may already
    // be ~45 seconds old. Account for its timestamp so both pages stay aligned.
    val age = observed?.let { stamp -> runCatching {
        (System.currentTimeMillis() - Instant.parse(stamp).toEpochMilli()) / 1000
    }.getOrNull() }
    val fresh = age == null || age in 0L..60L
    val initialAge = if (ticking && age != null && age in 0L..60L) age.toInt() else 0
    var delta by remember(match.id, observed, seconds, ticking) {
        mutableIntStateOf(initialAge)
    }
    LaunchedEffect(match.id, observed, seconds, ticking) {
        delta = initialAge
        if (match.live && seconds != null && ticking && fresh) {
            repeat(60 - initialAge) {
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
