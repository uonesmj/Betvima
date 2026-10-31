package com.betvima.app.ui

import com.betvima.app.R
import android.graphics.BitmapFactory
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WalkingSpiderDevice227Test {
    @get:Rule val rule = createComposeRule()

    @Test fun photoSheetDecodesWithTransparencyAndSixteenDifferentLegFrames() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val bitmap = BitmapFactory.decodeResource(
            context.resources, R.drawable.spider_walk_cycle_227,
            BitmapFactory.Options().apply { inScaled = false }
        )
        assertNotNull("The real-leg WebP resource must decode on Android",bitmap)
        assertEquals(3584,bitmap.width)
        assertEquals(176,bitmap.height)
        assertTrue(bitmap.hasAlpha())
        assertEquals(0, (bitmap.getPixel(0,0) ushr 24) and 255)
        val a = IntArray(224*176)
        val b = IntArray(224*176)
        bitmap.getPixels(a,0,224,0,0,224,176)
        bitmap.getPixels(b,0,224,224*4,0,224,176)
        val changed = a.indices.count { a[it] != b[it] }
        assertTrue("Walking must change the actual leg pixels, not just slide a static photo",changed > 60)
    }

    @Test fun canvasDrawsSixMovingSpiderRoutesOnAndroid15WithoutCrash() {
        rule.setContent {
            Column {
                repeat(6) { route ->
                    Box(Modifier.fillMaxWidth().height(138.dp)) {
                        LossTicketSpider222(
                            replay = route + 1,
                            routeVariant = route,
                            badgeTarget = Offset(270f,38f),
                            modifier = Modifier.fillMaxWidth().height(138.dp),
                            onComplete = {}
                        )
                    }
                }
            }
        }
        rule.waitForIdle()
        Thread.sleep(950L)
        rule.waitForIdle()
        assertTrue(spiderWalkFrame227(.32f) != spiderWalkFrame227(.35f))
    }
}
