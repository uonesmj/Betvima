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

    @Test fun newEightFeetRemainSeparatedFromThoraxAndEachOther() {
        val path = route()
        val travel = path.length * .46f
        val body = path.position(travel)
        val direction = path.heading(travel)
        val normal = Offset(-direction.y, direction.x)
        val feet = (0 until 8).map { spiderFoot231(it, travel, path, 1f) }
        for (i in 0..7) {
            val side = if (i < 4) -1f else 1f
            val lateral = (feet[i] - body).x * normal.x +
                (feet[i] - body).y * normal.y
            assertTrue("Foot must stay outside the thorax on its own side",
                lateral * side > 12f)
        }
        for (row in 0..3) {
            assertTrue("Opposite feet must not overlap",
                (feet[row] - feet[row + 4]).getDistance() > 34f)
        }
    }

    @Test fun plantedToeIsFixedAndNewJointBendsOutward() {
        val path = route()
        val d = 6f * SPIDER_STEP_LENGTH_DP_231
        val p1 = spiderFoot231(0, d + .05f * SPIDER_STEP_LENGTH_DP_231, path, 1f)
        val p2 = spiderFoot231(0, d + .48f * SPIDER_STEP_LENGTH_DP_231, path, 1f)
        assertEquals(p1.x, p2.x, .0001f)
        assertEquals(p1.y, p2.y, .0001f)
        val head = path.position(d)
        val forward = path.heading(d)
        val outward = Offset(forward.y, -forward.x)
        val hip = head + outward * 5f
        val knee = spiderJoint231(hip, p1, forward, outward, 0, 1f)
        val midpoint = hip + (p1 - hip) * .48f
        val displacement = knee - midpoint
        assertTrue("New knee must visibly open outwards",
            displacement.getDistance() > 3f)
        assertTrue(SPIDER_SIZE_MULTIPLIER_231 < SPIDER_SIZE_MULTIPLIER_230)
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
