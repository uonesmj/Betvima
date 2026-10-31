package com.betvima.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Runs the actual Android Compose Canvas renderer for each route.
 * This catches device-only draw failures that JVM geometry tests miss.
 */
@RunWith(AndroidJUnit4::class)
class LossSpiderEmulatorSmoke225Test {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun allSixSpiderEntrancesRenderOnAndroidWithoutCrashing() {
        composeRule.setContent {
            Column {
                repeat(6) { route ->
                    Box(Modifier.fillMaxWidth().height(136.dp)) {
                        LossTicketSpider222(
                            replay = route + 1,
                            routeVariant = route,
                            badgeTarget = Offset(280f, 37f),
                            modifier = Modifier.fillMaxWidth().height(136.dp),
                            onComplete = {}
                        )
                    }
                }
            }
        }
        composeRule.waitForIdle()
        // Pass the launch delay and exercise active leg and body drawing.
        Thread.sleep(1450L)
        composeRule.waitForIdle()
        assertTrue(true)
    }
}
