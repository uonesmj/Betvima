package com.betvima.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LiveSpiderFootplantEmulator229Test {
    @get:Rule val rule = createComposeRule()

    @Test fun composableRendersArticulatedLegsWithoutCrashing() {
        rule.setContent {
            Box(Modifier.fillMaxWidth().height(680.dp)) {
                LossTicketSpider222(
                    replay = 2, routeVariant = 1,
                    badgeTarget = Offset(284f, 38f),
                    modifier = Modifier.fillMaxWidth().height(680.dp),
                    onComplete = {}
                )
            }
        }
        rule.waitForIdle()
        Thread.sleep(1350L)
        rule.waitForIdle()
        assertTrue(true)
    }

    @Test fun feetAreAnchoredDuringStanceOnAndroidCompose() {
        val start = Offset(155f, 610f)
        val end = Offset(300f, 34f)
        val a = spiderFoot229(0, .025f, start, end, 350f, 770f, 1f)
        val b = spiderFoot229(0, .062f, start, end, 350f, 770f, 1f)
        assertEquals(a.x, b.x, .001f)
        assertEquals(a.y, b.y, .001f)
    }
}
