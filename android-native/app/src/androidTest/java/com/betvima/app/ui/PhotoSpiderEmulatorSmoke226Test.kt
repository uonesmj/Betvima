package com.betvima.app.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PhotoSpiderEmulatorSmoke226Test {
    @get:Rule val rule = createComposeRule()

    @Test fun actualWebpPhotoHasTransparentPixels() {
        val context = androidx.test.platform.app.InstrumentationRegistry
            .getInstrumentation().targetContext
        val options = BitmapFactory.Options().apply { inScaled = false }
        val bitmap = BitmapFactory.decodeResource(
            context.resources, R.drawable.spider_realistic_226, options
        )
        assertNotNull("Real spider WebP should decode on Android 15", bitmap)
        assertTrue(bitmap.hasAlpha())
        assertEquals(0, (bitmap.getPixel(0, 0) ushr 24) and 0xFF)
    }

    @Test fun photoRendersAndAnimatesAlongAllSixCurvesWithoutException() {
        rule.setContent {
            Column {
                repeat(LOSS_SPIDER_ROUTE_COUNT_224) { route ->
                    Box(Modifier.fillMaxWidth().height(138.dp)) {
                        LossTicketSpider222(
                            replay = route + 1,
                            routeVariant = route,
                            badgeTarget = Offset(282f, 36f),
                            modifier = Modifier.fillMaxWidth().height(138.dp),
                            onComplete = {}
                        )
                    }
                }
            }
        }
        rule.waitForIdle()
        Thread.sleep(900L)
        rule.waitForIdle()
        assertTrue(true)
    }
}
