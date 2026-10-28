package com.betvima.app.ui

import android.graphics.BitmapFactory
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Separate cinematic artwork and motion layers. Does not modify affiliate business rules.
 * Offline WEBP sources are bundled under the affiliate assets directory.
 * Missing art gracefully renders a branded gradient while awaiting asset review.
 */
internal enum class AffiliateScene(
    val photo:String,
    val accent:Color,
    val mark:ImageVector,
    val fallbackPhoto:String
) {
    HERO("bv_aff_hero",Color(0xFF2865EA),Icons.Default.SportsSoccer,"hero_stadium"),
    NUMBERS("bv_aff_numbers",Color(0xFF3669F4),Icons.Default.Groups,"partners"),
    ECOSYSTEM("bv_aff_ecosystem",Color(0xFF517CDB),Icons.Default.SportsSoccer,"football_team"),
    MOBILE("bv_aff_mobile",Color(0xFF30CEAF),Icons.Default.Smartphone,"app_showcase"),
    STATISTICS("bv_aff_statistics",Color(0xFF3879E6),Icons.Default.Leaderboard,"analytics"),
    CHART("bv_aff_chart",Color(0xFF3879E6),Icons.Default.ShowChart,"analytics"),
    GEOGRAPHY("bv_aff_geography",Color(0xFF3B83EF),Icons.Default.Public,"global_stadium"),
    CASINO("bv_aff_casino",Color(0xFF289E92),Icons.Default.Casino,"casino"),
    SPORTS("bv_aff_sports",Color(0xFF6D81E2),Icons.Default.SportsSoccer,"football_action"),
    FAQ("bv_aff_faq",Color(0xFF4A7CE6),Icons.Default.QuestionAnswer,"players"),
    JOIN("bv_aff_join",Color(0xFF3379CA),Icons.Default.Stars,"winning_moment"),
    GALLERY_MOBILE("bv_aff_gallery_mobile",Color(0xFF30CEAF),Icons.Default.Smartphone,"app_showcase"),
    GALLERY_SPORTS("bv_aff_gallery_sports",Color(0xFF6D81E2),Icons.Default.SportsSoccer,"football_action"),
    GALLERY_CASINO("bv_aff_gallery_casino",Color(0xFF289E92),Icons.Default.Casino,"casino"),
    GALLERY_INSIGHTS("bv_aff_gallery_insights",Color(0xFF3669F4),Icons.Default.ShowChart,"analytics"),
    GUIDE_START("bv_aff_guide_start",Color(0xFF29B7EE),Icons.Default.RocketLaunch,"players"),
    GUIDE_REVSHARE("bv_aff_guide_revshare",Color(0xFF8D74F9),Icons.Default.Percent,"partners"),
    GUIDE_REPORTING("bv_aff_guide_reporting",Color(0xFF20D5B6),Icons.Default.QueryStats,"winning_moment"),
    FAQ_REVSHARE("bv_aff_faq_revshare",Color(0xFF6C8EF8),Icons.Default.Percent,"people_3"),
    FAQ_EARNING("bv_aff_faq_earning",Color(0xFF24CF96),Icons.Default.TrendingUp,"football_team"),
    FAQ_CPA("bv_aff_faq_cpa",Color(0xFFA88BEE),Icons.Default.AccountTree,"people_1"),
    FAQ_PAYOUTS("bv_aff_faq_payouts",Color(0xFF51D3BC),Icons.Default.Payments,"global_stadium"),
    FAQ_STATISTICS("bv_aff_faq_statistics",Color(0xFF5A98F8),Icons.Default.BarChart,"app_showcase")
}

@Composable
internal fun AffiliateCinematicPhoto(
    scene:AffiliateScene, modifier:Modifier=Modifier,active:Boolean=true,
    corner:Int=24,showMark:Boolean=false,
    content:@Composable BoxScope.()->Unit={}
) {
    val context=LocalContext.current
    val chartScene = scene == AffiliateScene.STATISTICS ||
        scene == AffiliateScene.CHART || scene == AffiliateScene.GALLERY_INSIGHTS
    // Bitmap decoding on the Compose main thread previously blocked popup
    // entrance frames, especially on lower-end Android devices.
    val bitmap by produceState<androidx.compose.ui.graphics.ImageBitmap?>(
        initialValue = null, scene, context
    ) {
        value = if (chartScene) null else kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                val preferred = "affiliate/" + scene.photo + ".webp"
                val fallback = "affiliate/" + scene.fallbackPhoto + ".webp"
                runCatching { context.assets.open(preferred) }
                    .getOrElse { context.assets.open(fallback) }
                    .use { BitmapFactory.decodeStream(it)?.asImageBitmap() }
            }.getOrNull()
        }
    }
    val entrance by animateFloatAsState(if(active)1f else 0f,
        animationSpec=tween(850,easing=FastOutSlowInEasing),
        label="affiliate-photo-entrance")
    val glow=rememberInfiniteTransition(label="affiliate-luminous-accent")
    val drift by glow.animateFloat(initialValue=0f,targetValue=1f,
        animationSpec=infiniteRepeatable(tween(5800,easing=EaseInOutSine),
            repeatMode=RepeatMode.Reverse),label="affiliate-photo-drift")
    Box(modifier.clip(RoundedCornerShape(corner.dp))
        .background(Brush.linearGradient(listOf(Color(0xFF0E0E13),
            scene.accent.copy(alpha=.24f),Color(0xFF101116))))) {
        val resolvedBitmap = bitmap
        if(chartScene) {
            AffiliateAnimatedChart199(
                active = active,
                modifier = Modifier.fillMaxSize(),
                compact = scene != AffiliateScene.CHART
            )
        } else if(resolvedBitmap!=null) {
            // One image only. The old Crop + Fit double layer repeated
            // the stadium and athletes as horizontal bands in gallery cards.
            Image(
                bitmap = resolvedBitmap,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = Alignment.Center,
                modifier = Modifier.fillMaxSize().graphicsLayer {
                    alpha = .65f + .35f * entrance
                }
            )
        } else {
            Box(Modifier.fillMaxSize().background(Brush.radialGradient(
                listOf(scene.accent.copy(alpha=.14f),Color.Transparent))))
            Icon(scene.mark,null,modifier=Modifier.align(Alignment.Center)
                .size(86.dp).graphicsLayer {
                    alpha=.16f;rotationZ=(drift-.5f)*9f
                },tint=Color.White)
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
            0f to Color(0xFF080D17).copy(alpha=.04f),
            .65f to Color(0xFF080D17).copy(alpha=.12f),
            1f to Color(0xFF080D17).copy(alpha=.53f))))
        Box(Modifier.fillMaxWidth().height(115.dp).align(Alignment.BottomCenter)
            .background(Brush.verticalGradient(listOf(Color.Transparent,
                Color(0xFF080D17).copy(alpha=.45f)))))
        Box(Modifier.size(140.dp).align(Alignment.TopEnd)
            .graphicsLayer {
                alpha=.1f+drift*.09f
                translationX=20f-drift*40f
                translationY=-28f
            }.drawWithCache {
                onDrawBehind {
                    drawCircle(scene.accent.copy(alpha=.5f),
                        radius=size.minDimension*.5f)
                    drawCircle(Color.White.copy(alpha=.3f),
                        radius=size.minDimension*.34f,style=Stroke(3.dp.toPx()))
                }
            })
        if(showMark) {
            Row(Modifier.align(Alignment.TopStart).padding(13.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(Color(0xD609111E))
                .padding(horizontal=10.dp,vertical=7.dp),
                verticalAlignment=Alignment.CenterVertically) {
                Icon(painter=painterResource(com.betvima.app.R.drawable.ic_betvima_mini),
                    contentDescription=null,tint=scene.accent,
                    modifier=Modifier.size(14.dp))
                Spacer(Modifier.width(5.dp))
                Text("BetVima",color=Color.White,fontWeight=FontWeight.Black,
                    fontSize=13.sp,letterSpacing=(-.2).sp)
            }
        }
        Box(Modifier.fillMaxSize().graphicsLayer {
            alpha=entrance;translationY=(1f-entrance)*32f
        },content=content)
    }
}

@Composable
internal fun AffiliateReveal(
    visible:Boolean,delayMillis:Int=0,modifier:Modifier=Modifier,
    content:@Composable ()->Unit
) {
    val entrance by animateFloatAsState(if(visible)1f else 0f,
        animationSpec=tween(durationMillis=760,delayMillis=delayMillis,
            easing=FastOutSlowInEasing),label="affiliate-scroll-reveal")
    Box(modifier.graphicsLayer {
        alpha=entrance.coerceIn(0f,1f);translationY=(1f-entrance)*55f
        scaleX=.975f+entrance*.025f;scaleY=.975f+entrance*.025f
    }) { content() }
}
