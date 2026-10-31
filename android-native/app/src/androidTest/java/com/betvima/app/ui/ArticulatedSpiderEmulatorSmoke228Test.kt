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
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ArticulatedSpiderEmulatorSmoke228Test {
    @get:Rule val rule = createComposeRule()

    @Test fun the48GaitPosesAreDecodedAsTransparentTiledBitmap() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        val bitmap = BitmapFactory.decodeResource(
            ctx.resources, R.drawable.spider_walk_cycle_228,
            BitmapFactory.Options().apply { inScaled = false }
        )
        assertNotNull(bitmap)
        assertEquals(160 * 8, bitmap.width)
        assertEquals(130 * 6, bitmap.height)
        assertTrue("Sprite sheet must have transparent background", bitmap.hasAlpha())
        assertEquals(0, (bitmap.getPixel(0, 0) ushr 24) and 255)
    }

    @Test fun allSixCurvedLossRoutesRenderAndAnimateWithoutCrashing() {
        rule.setContent {
            Column {
                repeat(6) { route ->
                    Box(Modifier.fillMaxWidth().height(148.dp)) {
                        LossTicketSpider222(
                            replay = route + 1,
                            routeVariant = route,
                            badgeTarget = Offset(287f, 36f),
                            modifier = Modifier.fillMaxWidth().height(148.dp),
                            onComplete = {}
                        )
                    }
                }
            }
        }
        rule.waitForIdle()
        Thread.sleep(1300L)
        rule.waitForIdle()
        assertTrue(true)
    }
}
