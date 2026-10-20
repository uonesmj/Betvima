package com.betvima.app.ui

import com.betvima.app.data.LiveMatchFacts
import com.betvima.app.data.LiveStat
import org.junit.Assert.*
import org.junit.Test

class LiveIncidentCue129Test {
    private fun sample(at: String, score: String = "0-0",
                       stats: List<LiveStat> = emptyList(), fi: String = "123") =
        LiveMatchFacts(fi = fi, minute = 53, clockSeconds = 3180,
            clockRunning = true, score = score, stats = stats, observedAt = at)
    private fun stat(key: String, h: Int, a: Int) =
        LiveStat(key, key, key, h, a)
    private val early = "2026-10-20T09:00:00Z"
    private val later = "2026-10-20T09:00:14Z"

    @Test fun firstSnapshotDoesNotReplayAllHistoricalStatistics() {
        val current = sample(later, "2-1", listOf(stat("corners", 5, 3)))
        assertTrue(observedIncidents129(null, current).isEmpty())
    }

    @Test fun dedupesSameSnapshotAndRejectsOldProviderSamples() {
        val previous = sample(early, stats = listOf(stat("corners", 1, 0)))
        val current = sample(later, stats = listOf(stat("corners", 2, 0)))
        assertEquals(IncidentKind129.CORNER, observedIncidents129(previous, current).single().kind)
        assertTrue(observedIncidents129(current, current).isEmpty())
        assertTrue(observedIncidents129(current, previous).isEmpty())
        assertTrue(observedIncidents129(previous, current.copy(fi = "987")).isEmpty())
    }

    @Test fun ignoresCounterCorrectionAndLongReconnectionGap() {
        val before = sample(early, stats = listOf(stat("fouls", 4, 2)))
        val corrected = sample(later, stats = listOf(stat("fouls", 2, 2)))
        assertTrue(observedIncidents129(before, corrected).isEmpty())
        assertTrue(observedIncidents129(before,
            sample("2026-10-20T09:05:01Z", stats = listOf(stat("fouls", 7, 2)))).isEmpty())
    }

    @Test fun prioritizesVerifiedGoalAndAvoidsDuplicatedOnTarget() {
        val previous = sample(early, score = "0-0", stats = listOf(
            stat("on_target", 1, 1), stat("corners", 0, 0)))
        val current = sample(later, score = "1-0", stats = listOf(
            stat("on_target", 2, 1), stat("corners", 1, 0)))
        val cues = observedIncidents129(previous, current)
        assertEquals(IncidentKind129.GOAL, cues[0].kind)
        assertTrue(cues[0].confirmedScore)
        assertTrue(cues.none { it.kind == IncidentKind129.SHOT_ON })
    }

    @Test fun unknownPenaltyIsNeverInventedFromFouls() {
        val prior = sample(early, stats = listOf(stat("fouls", 0, 0)))
        val next = sample(later, stats = listOf(stat("fouls", 1, 0)))
        assertEquals(IncidentKind129.FOUL, observedIncidents129(prior, next).single().kind)
    }

    @Test fun realPenaltyStatMayTriggerOnePenaltyCue() {
        val prior = sample(early, stats = listOf(stat("penalties", 0, 0)))
        val next = sample(later, stats = listOf(stat("penalties", 0, 1)))
        val cue = observedIncidents129(prior, next).single()
        assertEquals(IncidentKind129.PENALTY, cue.kind)
        assertEquals(IncidentSide129.AWAY, cue.side)
    }

    @Test fun limitsBurstAndPreservesPriorityForImportantEvents() {
        val prev = sample(early, stats = listOf(
            stat("attacks", 10, 10), stat("corners", 0, 0),
            stat("redcards", 0, 0), stat("dangerous_attacks", 2, 2)))
        val next = sample(later, stats = listOf(
            stat("attacks", 12, 11), stat("corners", 1, 0),
            stat("redcards", 0, 1), stat("dangerous_attacks", 3, 2)))
        val cues = observedIncidents129(prev, next)
        assertEquals(2, cues.size)
        assertEquals(IncidentKind129.RED_CARD, cues[0].kind)
        assertEquals(IncidentKind129.CORNER, cues[1].kind)
    }
}
