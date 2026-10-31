package com.betvima.app.ui

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SpiderGroundedGait230Test {
    private fun route() = SpiderArcPath230(
        Offset(153f, 620f), Offset(295f, 36f), 350f, 770f
    )

    @Test fun curvedDistanceMapIsMonotonicAndGaitUsesTravelledPixels() {
        val path = route()
        assertTrue(path.length > 520f)
        assertEquals(0f, path.distanceAt(0f), .0001f)
        assertEquals(path.length, path.distanceAt(1f), .001f)
        val samples = (0..100).map { path.distanceAt(it / 100f) }
        assertTrue(samples.zipWithNext().all { (a, b) -> b > a })
        assertEquals(0f, (path.position(0f) - Offset(153f,620f)).getDistance(), .01f)
        assertTrue(path.heading(path.length * .5f).getDistance() > .95f)
    }

    @Test fun eightLegsTakeTurnsAndPlantedFootNeverSkates() {
        val path = route()
        val step = SPIDER_STEP_LENGTH_DP_230
        val first = spiderFoot230(0, 5.10f * step, path, 1f)
        val next = spiderFoot230(0, 5.55f * step, path, 1f)
        assertEquals(first.x, next.x, .0001f)
        assertEquals(first.y, next.y, .0001f)
        val airborne = spiderFoot230(0, 5.86f * step, path, 1f)
        assertTrue((airborne - first).getDistance() > 1.2f)
        val other = spiderFoot230(1, 5.86f * step, path, 1f)
        assertTrue((other - airborne).getDistance() > 4f)
        assertEquals(.64f, SPIDER_STANCE_SHARE_230, .0001f)
    }

    @Test fun kneesBendWhenHipsAdvanceTowardFixedFeet() {
        val toe = Offset(150f, 180f)
        val a = spiderKnee230(Offset(130f,157f),toe,Offset(1f,0f),1f)
        val b = spiderKnee230(Offset(135f,161f),toe,Offset(1f,0f),1f)
        assertTrue((a-b).getDistance()>1f)
    }

    @Test fun bodyIsSmallerWithoutScalingWorldSpaceFootCoordinates() {
        assertEquals(.79f, SPIDER_SIZE_MULTIPLIER_230,.001f)
        assertEquals(17f, SPIDER_STEP_LENGTH_DP_230,.001f)
        val path = route()
        val anchored = spiderFoot230(7, 65f, path,1f)
        assertEquals(anchored,spiderFoot230(7,65f,path,1f))
        assertNotEquals(spiderFoot230(0,65f,path,1f),anchored)
    }
}
