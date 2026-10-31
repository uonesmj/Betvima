package com.betvima.app.ui

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class LossTicketSpider222Test {
    @Test fun allEntrancesStartInsideMiddleOfCardAndVaryOnEachOpen() {
        val starts = (0 until LOSS_SPIDER_ROUTE_COUNT_224).map {
            lossSpiderStart224(it, 350f, 770f)
        }
        assertEquals(6, starts.distinct().size)
        for (start in starts) {
            assertTrue("Starts in the central region, not at a card edge",
                start.x in 105f..225f)
            assertTrue("Starts in the middle/lower body of ticket",
                start.y in 385f..630f)
        }
        assertEquals(starts[0], lossSpiderStart224(6, 350f, 770f))
    }

    @Test fun eachRouteTakesCurvedNonLinearPathIntoTheActualLostChip() {
        val badge = Offset(288f, 35f)
        for (route in 0 until 6) {
            val start = lossSpiderStart224(route, 350f, 770f)
            val end = lossSpiderBadgeEntry224(badge, route, 1f)
            assertEquals(start, lossSpiderPoint222(start, end, 350f, 770f, 0f))
            assertEquals(end, lossSpiderPoint222(start, end, 350f, 770f, 1f))
            val mid = lossSpiderPoint222(start, end, 350f, 770f, .5f)
            val linearX = (start.x + end.x) / 2f
            assertTrue("The route must bend, not fly in a straight line",
                abs(mid.x - linearX) > 4f)
            assertTrue("The spider advances toward Lost as the route progresses",
                mid.y < start.y && mid.y > end.y)
            assertNotEquals("Arrival point changes by route",
                start, end)
        }
    }

    @Test fun photoArrivalPointsStayInsideMeasuredLostChip() {
        val target = Offset(294f, 36f)
        val points = (0 until 6).map { lossSpiderBadgeEntry224(target, it, 1f) }
        assertEquals(6, points.distinct().size)
        for (p in points) {
            assertTrue(abs(p.x - target.x) <= 3.01f)
            assertTrue(abs(p.y - target.y) <= 2.01f)
        }
    }

    @Test fun allFortyEightJointPosesRenderAndMoveWithDistance() {
        assertEquals(48, SPIDER_WALK_FRAME_COUNT_227)
        assertEquals(160, SPIDER_WALK_FRAME_WIDTH_227)
        assertEquals(130, SPIDER_WALK_FRAME_HEIGHT_227)
        assertEquals(8, SPIDER_WALK_GRID_COLUMNS_228)
        val poses = (0..10000).map { spiderWalkFrame227(it / 10000f) }.toSet()
        assertEquals("Every anatomical foot pose must be displayed", 48, poses.size)
        assertTrue(spiderWalkFrame227(.02f) != spiderWalkFrame227(.08f))
        assertEquals(0, spiderWalkFrame227(0f))
    }

    @Test fun distanceEaseIsStrictlyForwardAndLocomotionFollowsMotion() {
        val distances = (0..500).map { spiderWalkingDistance228(it / 500f) }
        assertEquals(0f, distances.first(), .0001f)
        assertEquals(1f, distances.last(), .0001f)
        assertTrue(distances.zipWithNext().all { (a, b) -> b > a })
        assertTrue(kotlin.math.abs(spiderWalkingDistance228(.125f) - .125f) > .01f)
    }

    @Test fun stanceFootIsFixedInWorldCoordinatesWhileBodyAdvances() {
        val start = Offset(155f, 610f)
        val end = Offset(300f, 34f)
        val a = spiderFoot229(0, .028f, start, end, 350f, 770f, 1f)
        val b = spiderFoot229(0, .060f, start, end, 350f, 770f, 1f)
        assertEquals("The planted toe must not slide when the body moves", a.x, b.x, .001f)
        assertEquals("The planted toe must not slide when the body moves", a.y, b.y, .001f)
        val bodyA = lossSpiderPoint222(start, end, 350f, 770f, .028f)
        val bodyB = lossSpiderPoint222(start, end, 350f, 770f, .060f)
        assertTrue("The body must advance above fixed feet",
            kotlin.math.abs(bodyB.y - bodyA.y) > 5f)
    }

    @Test fun staggeredLegsLiftAndReplaceTheirAnchorsIndependently() {
        val start = Offset(155f, 610f)
        val end = Offset(300f, 34f)
        val stance = spiderFoot229(0, .055f, start, end, 350f, 770f, 1f)
        val swing = spiderFoot229(0, .105f, start, end, 350f, 770f, 1f)
        assertTrue("Swinging foot must move independently of the planted foot",
            (stance - swing).getDistance() > 3f)
        val left = spiderFoot229(0, .105f, start, end, 350f, 770f, 1f)
        val right = spiderFoot229(4, .105f, start, end, 350f, 770f, 1f)
        assertTrue("Opposite legs have separate planted coordinates",
            (left - right).getDistance() > 30f)
        assertEquals(8, SPIDER_IK_STRIDES_229)
        assertEquals(.68f, SPIDER_IK_STANCE_FRACTION_229, .001f)
    }

    @Test fun riggedKneeChangesAsFixedFootRemainsPlanted() {
        val toe = Offset(128f, 180f)
        val a = spiderKnee229(Offset(98f, 150f), toe, Offset(1f, 0f), -1f, 1f)
        val b = spiderKnee229(Offset(110f, 145f), toe, Offset(1f, 0f), -1f, 1f)
        assertTrue("Knee bends as body advances toward planted toe",
            (a - b).getDistance() > 3f)
    }

    @Test fun safeRouteCounterAndSinglePlayTime() {
        assertEquals(6, LOSS_SPIDER_ROUTE_COUNT_224)
        assertEquals(380L, LOSS_SPIDER_DELAY_MS_222)
        assertEquals(3900, LOSS_SPIDER_DURATION_MS_222)
        assertEquals(4280L, LOSS_SPIDER_TOTAL_MS_222)
        assertTrue(lossSpiderEntryIndex225(1, Int.MIN_VALUE) in 0..5)
        assertTrue(lossSpiderEntryIndex225(1, Int.MAX_VALUE) in 0..5)
        assertNotEquals(lossSpiderEntryIndex225(1, 417),
            lossSpiderEntryIndex225(2, 417))
    }
}
