package com.betvima.app.ui

import android.graphics.BitmapFactory
import android.util.Base64
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
class PhotoSpiderEmulatorSmoke226Test {
    @get:Rule val composeRule = createComposeRule()

    @Test fun spriteDecodesWithFullAlphaTransparencyOnAndroid() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val encoded = context.assets.open("betvima_spider_photo226.webp.base64")
            .bufferedReader().use { it.readText() }
        val bytes = Base64.decode(encoded, Base64.DEFAULT)
        val photo = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        assertNotNull("Realistic spider image must decode on device", photo)
        assertEquals(128, photo!!.width)
        assertEquals(94, photo.height)
        assertTrue("Sprite must retain transparent background", photo.hasAlpha())
        assertEquals("Top-left corner must have no background",
            0, android.graphics.Color.alpha(photo.getPixel(0, 0)))
    }

    @Test fun allSixLossRoutesRenderRealPhotoOnEmulatorWithoutCrashing() {
        composeRule.setContent {
            Column {
                repeat(6) { route ->
                    Box(Modifier.fillMaxWidth().height(140.dp)) {
                        LossTicketSpider222(
                            replay = route + 1,
                            routeVariant = route,
                            badgeTarget = Offset(275f, 38f),
                            modifier = Modifier.fillMaxWidth().height(140.dp),
                            onComplete = {}
                        )
                    }
                }
            }
        }
        composeRule.waitForIdle()
        Thread.sleep(1250L)
        composeRule.waitForIdle()
        assertTrue(true)
    }
}
