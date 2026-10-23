package com.betvima.app.ui

import com.betvima.app.data.LiveMatchFacts
import java.time.Instant

/**
 * Counter deltas represent newly observed statistics, not precise incident
 * locations or official event timestamps from a dedicated timeline provider.
 */
internal enum class IncidentKind129 {
    GOAL, PENALTY, RED_CARD, YELLOW_CARD, SHOT_ON, SHOT_OFF,
    CORNER, OFFSIDE, FOUL, THROW_IN, FREE_KICK, GOAL_KICK,
    DANGEROUS_ATTACK, ATTACK
}

internal enum class IncidentSide129 { HOME, AWAY }

internal data class LiveIncidentCue129(
    val kind: IncidentKind129,
    val side: IncidentSide129,
    val amount: Int,
    val minute: Int?,
    val observation: String,
    val confirmedScore: Boolean = false
) {
    val key: String get() = observation + ":" + kind.name + ":" + side.name
    val durationMs: Long get() = when (kind) {
        IncidentKind129.GOAL -> 5200L
        IncidentKind129.PENALTY, IncidentKind129.RED_CARD -> 4300L
        IncidentKind129.DANGEROUS_ATTACK, IncidentKind129.ATTACK -> 2400L
        else -> 3300L
    }
}

internal fun observedIncidents129(
    previous: LiveMatchFacts?,
    current: LiveMatchFacts?
): List<LiveIncidentCue129> {
    if (previous == null || current == null || previous.fi != current.fi ||
        current.observedAt == previous.observedAt) return emptyList()
    val beforeTime = runCatching { Instant.parse(previous.observedAt) }.getOrNull()
    val afterTime = runCatching { Instant.parse(current.observedAt) }.getOrNull()
    if (beforeTime == null || afterTime == null || !afterTime.isAfter(beforeTime)) return emptyList()
    // An outage can accumulate numerous increments. Don't replay them as
    // events on reconnect.
    if (afterTime.epochSecond - beforeTime.epochSecond > 95L) return emptyList()

    val cues = mutableListOf<LiveIncidentCue129>()
    val priorScore = previous.score?.split("-")?.mapNotNull(String::toIntOrNull)
    val nextScore = current.score?.split("-")?.mapNotNull(String::toIntOrNull)
    if (priorScore?.size == 2 && nextScore?.size == 2) {
        for (i in 0..1) {
            val difference = nextScore[i] - priorScore[i]
            if (difference == 1) cues += LiveIncidentCue129(
                IncidentKind129.GOAL, if (i == 0) IncidentSide129.HOME else IncidentSide129.AWAY,
                1, current.minute, current.observedAt, confirmedScore = true
            )
        }
    }

    val metrics = listOf(
        Triple("penalties", IncidentKind129.PENALTY, 1),
        Triple("redcards", IncidentKind129.RED_CARD, 2),
        Triple("yellowcards", IncidentKind129.YELLOW_CARD, 3),
        Triple("on_target", IncidentKind129.SHOT_ON, 4),
        Triple("off_target", IncidentKind129.SHOT_OFF, 4),
        Triple("corners", IncidentKind129.CORNER, 4),
        Triple("offsides", IncidentKind129.OFFSIDE, 4),
        Triple("fouls", IncidentKind129.FOUL, 5),
        Triple("throwins", IncidentKind129.THROW_IN, 6),
        Triple("freekicks", IncidentKind129.FREE_KICK, 4),
        Triple("goalkicks", IncidentKind129.GOAL_KICK, 4),
        Triple("dangerous_attacks", IncidentKind129.DANGEROUS_ATTACK, 12),
        Triple("attacks", IncidentKind129.ATTACK, 15)
    )
    for ((metric, kind, limit) in metrics) {
        val old = previous.stat(metric) ?: continue
        val now = current.stat(metric) ?: continue
        for (side in IncidentSide129.entries) {
            val from = if (side == IncidentSide129.HOME) old.home else old.away
            val to = if (side == IncidentSide129.HOME) now.home else now.away
            if (from == null || to == null || from < 0 || to < 0) continue
            val increase = to - from
            if (increase !in 1..limit) continue
            if (kind == IncidentKind129.SHOT_ON && cues.any {
                    it.kind == IncidentKind129.GOAL && it.side == side
                }) continue
            cues += LiveIncidentCue129(kind, side, increase, current.minute, current.observedAt)
        }
    }
    return cues.distinctBy { it.kind to it.side }.sortedWith(
        compareBy<LiveIncidentCue129> { it.kind.ordinal }.thenByDescending { it.amount }
    ).take(2)
}

internal fun incidentCaption129(kind: IncidentKind129, fa: Boolean, lang: Lang = if (fa) Lang.FA else Lang.EN): String = when (kind) {
    IncidentKind129.GOAL -> trLive177(lang, "GOAL!", "گل!")
    IncidentKind129.PENALTY -> trLive177(lang, "Penalty recorded", "پنالتی ثبت‌شده")
    IncidentKind129.RED_CARD -> trLive177(lang, "Red card", "کارت قرمز")
    IncidentKind129.YELLOW_CARD -> trLive177(lang, "Yellow card", "کارت زرد")
    IncidentKind129.SHOT_ON -> trLive177(lang, "Shot on target", "شوت در چارچوب")
    IncidentKind129.SHOT_OFF -> trLive177(lang, "Shot off target", "شوت خارج چارچوب")
    IncidentKind129.CORNER -> trLive177(lang, "Corner", "کرنر")
    IncidentKind129.OFFSIDE -> trLive177(lang, "Offside", "آفساید")
    IncidentKind129.FOUL -> trLive177(lang, "Foul", "خطا")
    IncidentKind129.THROW_IN -> trLive177(lang, "Throw-in", "اوت دستی")
    IncidentKind129.FREE_KICK -> trLive177(lang, "Free kick", "ضربه آزاد")
    IncidentKind129.GOAL_KICK -> trLive177(lang, "Goal kick", "ضربه دروازه")
    IncidentKind129.DANGEROUS_ATTACK -> trLive177(lang, "Dangerous attack", "حمله خطرناک")
    IncidentKind129.ATTACK -> trLive177(lang, "Attack", "حمله")
}
