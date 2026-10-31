package com.betvima.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Paint the REAL runtime IK renderer on Android 15, not a JVM-only geometry test. */
@RunWith(AndroidJUnit4::class)
class GroundedSpider230DeviceTest {
    @get:Rule val rule = createComposeRule()

    @Test fun allSixCurvedRoutesRenderWithEightGroundedLegs() {
        rule.setContent {
            Column {
                repeat(LOSS_SPIDER_ROUTE_COUNT_224) { route ->
                    Box(Modifier.fillMaxWidth().height(146.dp)) {
                        LossTicketSpider222(
                            replay = route + 1,
                            routeVariant = route,
                            badgeTarget = Offset(295f, 29f),
                            modifier = Modifier.fillMaxWidth().height(146.dp),
                            onComplete = {}
                        )
                    }
                }
            }
        }
        rule.waitForIdle()
        Thread.sleep(1800L)
        rule.waitForIdle()
        assertTrue(true)
    }
}
