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
 * Ten offline WEBP images are expected under the affiliate assets directory.
 * Missing art gracefully renders a branded gradient while awaiting asset review.
 */
internal enum class AffiliateScene(val photo:String,val accent:Color,val mark:ImageVector) {
    HERO("hero_stadium",Color(0xFF00D47A),Icons.Default.SportsSoccer),
    NUMBERS("partners",Color(0xFF087FF5),Icons.Default.Groups),
    ECOSYSTEM("football_team",Color(0xFF00D47A),Icons.Default.SportsSoccer),
    MOBILE("app_showcase",Color(0xFF087FF5),Icons.Default.Smartphone),
    STATISTICS("analytics",Color(0xFF00D47A),Icons.Default.Leaderboard),
    GEOGRAPHY("global_stadium",Color(0xFF087FF5),Icons.Default.Public),
    CASINO("casino",Color(0xFF925FEF),Icons.Default.Casino),
    SPORTS("football_action",Color(0xFF00D47A),Icons.Default.SportsSoccer),
    FAQ("players",Color(0xFF087FF5),Icons.Default.QuestionAnswer),
    JOIN("winning_moment",Color(0xFF00D47A),Icons.Default.Stars)
}

@Composable
internal fun AffiliateCinematicPhoto(
    scene:AffiliateScene, modifier:Modifier=Modifier,active:Boolean=true,
    corner:Int=24,showMark:Boolean=false,
    content:@Composable BoxScope.()->Unit={}
) {
    val context=LocalContext.current
    // Bitmap decoding on the Compose main thread previously blocked popup
    // entrance frames, especially on lower-end Android devices.
    val bitmap by produceState<androidx.compose.ui.graphics.ImageBitmap?>(
        initialValue = null, scene, context
    ) {
        value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                context.assets.open("affiliate/" + scene.photo + ".webp").use {
                    BitmapFactory.decodeStream(it)?.asImageBitmap()
                }
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
        .background(Brush.linearGradient(listOf(Color(0xFF0A1426),
            scene.accent.copy(alpha=.58f),Color(0xFF111827))))) {
        if(bitmap!=null) {
            // One image only. The old Crop + Fit double layer repeated
            // the stadium and athletes as horizontal bands in gallery cards.
            Image(
                bitmap = bitmap,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = Alignment.Center,
                modifier = Modifier.fillMaxSize().graphicsLayer {
                    alpha = .65f + .35f * entrance
                }
            )
        } else {
            Box(Modifier.fillMaxSize().background(Brush.radialGradient(
                listOf(scene.accent.copy(alpha=.4f),Color.Transparent))))
            Icon(scene.mark,null,modifier=Modifier.align(Alignment.Center)
                .size(86.dp).graphicsLayer {
                    alpha=.16f;rotationZ=(drift-.5f)*9f
                },tint=Color.White)
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
            0f to Color(0xFF080D17).copy(alpha=.08f),
            .65f to Color(0xFF080D17).copy(alpha=.2f),
            1f to Color(0xFF080D17).copy(alpha=.87f))))
        Box(Modifier.fillMaxWidth().height(115.dp).align(Alignment.BottomCenter)
            .background(Brush.verticalGradient(listOf(Color.Transparent,
                Color(0xFF080D17).copy(alpha=.85f)))))
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
