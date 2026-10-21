package com.betvima.app.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIosNew
import androidx.compose.material.icons.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.NorthEast
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Native Compose-only affiliate marketing presentation. This module never
// handles authentication, financial data, payouts or betting eligibility.
private val electric = Color(0xFF359AFF)
private val base = Color(0xFF070B09)
private val paper = Color(0xFFF7FAF6)
private val emerald = Color(0xFF50D78E)

/** A full-width seam touching the sections on both sides, with circuit traces
 * following the curved panel boundary. Not a detached straight separator.
 */
@Composable
internal fun AffiliateConnectedBridge151(
    lightAfter: Boolean,
    modifier: Modifier = Modifier
) {
    Canvas(modifier.fillMaxWidth().height(69.dp).background(base)) {
        val w = size.width
        val h = size.height
        val seam = Path().apply {
            if (lightAfter) {
                moveTo(0f, h * .40f)
                lineTo(w * .19f, h * .40f)
                cubicTo(w * .28f, h * .40f, w * .26f, h * .70f, w * .35f, h * .70f)
                lineTo(w * .75f, h * .70f)
                cubicTo(w * .84f, h * .70f, w * .83f, h * .37f, w * .91f, h * .37f)
                lineTo(w, h * .37f)
                lineTo(w, h)
                lineTo(0f, h)
            } else {
                moveTo(0f, 0f)
                lineTo(w, 0f)
                lineTo(w, h * .25f)
                cubicTo(w * .93f, h * .25f, w * .92f, h * .56f, w * .83f, h * .56f)
                lineTo(w * .53f, h * .56f)
                cubicTo(w * .47f, h * .56f, w * .45f, h * .22f, w * .37f, h * .22f)
                lineTo(w * .12f, h * .22f)
                lineTo(0f, h * .25f)
            }
            close()
        }
        drawPath(seam, paper)
        val trace = Path().apply {
            moveTo(-3f, if (lightAfter) h * .32f else h * .48f)
            lineTo(w * .13f, if (lightAfter) h * .32f else h * .48f)
            lineTo(w * .21f, if (lightAfter) h * .65f else h * .74f)
            lineTo(w * .35f, if (lightAfter) h * .65f else h * .74f)
            lineTo(w * .41f, h * .88f)
            lineTo(w * .60f, h * .88f)
            lineTo(w * .70f, h * .47f)
            lineTo(w * .84f, h * .47f)
            lineTo(w * .91f, h * .21f)
            lineTo(w + 3f, h * .21f)
        }
        val trace2 = Path().apply {
            moveTo(-3f, h * .71f)
            lineTo(w * .10f, h * .71f)
            lineTo(w * .17f, h * .89f)
            lineTo(w * .29f, h * .89f)
            moveTo(w * .52f, h * .64f)
            lineTo(w * .61f, h * .64f)
            lineTo(w * .68f, h * .29f)
            lineTo(w * .81f, h * .29f)
        }
        drawPath(trace, Color(0x402080FF), style=Stroke(width=10.dp.toPx(),
            cap=StrokeCap.Round, join=StrokeJoin.Round))
        drawPath(trace, electric, style=Stroke(width=1.7.dp.toPx(),
            cap=StrokeCap.Round, join=StrokeJoin.Round))
        drawPath(trace2, Color(0xFF2372BD), style=Stroke(width=1.15.dp.toPx(),
            cap=StrokeCap.Round, join=StrokeJoin.Round))
        listOf(Offset(w*.13f, if(lightAfter)h*.32f else h*.48f),
            Offset(w*.60f,h*.88f),Offset(w*.84f,h*.47f)).forEach { center ->
            drawCircle(Color(0x442F99FF),radius=9.dp.toPx(),center=center)
            drawCircle(Color(0xFF81D3FF),radius=3.3.dp.toPx(),center=center)
            drawCircle(Color.White,radius=1.8.dp.toPx(),center=center)
        }
    }
}

@Composable
internal fun AffiliateDarkCircuit151() {
    Canvas(Modifier.fillMaxWidth().height(42.dp).background(base)) {
        val w=size.width
        val h=size.height
        val path=Path().apply {
            moveTo(0f,h*.25f);lineTo(w*.19f,h*.25f)
            lineTo(w*.27f,h*.8f);lineTo(w*.65f,h*.8f)
            lineTo(w*.72f,h*.24f);lineTo(w,h*.24f)
        }
        drawPath(path,Color(0x552071FA),
            style=Stroke(9.dp.toPx(),cap=StrokeCap.Round,join=StrokeJoin.Round))
        drawPath(path,electric,
            style=Stroke(1.7.dp.toPx(),cap=StrokeCap.Round,join=StrokeJoin.Round))
        drawCircle(Color(0xFFB3EDFF),4.dp.toPx(),Offset(w*.65f,h*.8f))
    }
}

private data class EditorialPhoto151(val english: String, val persian: String)
private val editorialTitles151 = listOf(
    EditorialPhoto151("Fashion campaign", "کمپین مد و برند"),
    EditorialPhoto151("Editorial portrait", "پرتره تبلیغاتی"),
    EditorialPhoto151("Outdoor lifestyle", "سبک زندگی و ورزش"),
    EditorialPhoto151("Studio fashion", "عکاسی استودیویی")
)

/** Load the four reference-photo quadrants once on an IO dispatcher.
 * The WebP sheet is bundled locally so the native gallery works offline.
 */
@Composable
private fun rememberEditorialPhotos151(): List<ImageBitmap> {
    val context = LocalContext.current
    val photos by produceState<List<ImageBitmap>>(initialValue=emptyList(),context) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                val original = context.assets.open("affiliate/people-sprite.webp")
                    .use { BitmapFactory.decodeStream(it) }
                    ?: return@runCatching emptyList()
                val width=original.width/2
                val height=original.height/2
                try {
                    listOf(0 to 0,1 to 0,0 to 1,1 to 1).map { (x,y) ->
                        Bitmap.createBitmap(original,x*width,y*height,width,height)
                            .asImageBitmap()
                    }
                } finally {
                    original.recycle()
                }
            }.getOrElse { emptyList() }
        }
    }
    return photos
}

@Composable
private fun EditorialImage151(
    bitmap: ImageBitmap?,
    description: String,
    modifier: Modifier = Modifier
) {
    if (bitmap != null) {
        Image(bitmap=bitmap,contentDescription=description,modifier=modifier,
            contentScale=ContentScale.Crop)
    } else {
        Box(modifier.background(Brush.verticalGradient(
            listOf(Color(0xFF142D31),Color(0xFF0A121A)))),
            contentAlignment=Alignment.Center) {
            Text("BetVima",fontWeight=FontWeight.Black,color=emerald,fontSize=20.sp)
        }
    }
}

@Composable
internal fun AffiliateRealPeopleGallery151(lang: Lang) {
    val photos=rememberEditorialPhotos151()
    var selected by remember { mutableIntStateOf(-1) }
    Column(
        Modifier.fillMaxWidth().background(base)
            .padding(top=26.dp,bottom=48.dp),
        verticalArrangement=Arrangement.spacedBy(15.dp)
    ) {
        Column(Modifier.padding(horizontal=22.dp)) {
            Text(tr(lang,"BRAND GALLERY","گالری تصاویر برند"),
                fontSize=11.sp,fontWeight=FontWeight.Black,
                letterSpacing=1.4.sp,color=emerald)
            Spacer(Modifier.height(9.dp))
            Text(tr(lang,"BetVima in focus","بت‌ویما از نمای نزدیک"),
                fontSize=28.sp,lineHeight=34.sp,
                fontWeight=FontWeight.Black,color=Color.White)
            Spacer(Modifier.height(6.dp))
            Text(tr(lang,
                "Four creative brand-photo concepts. Tap any image to explore.",
                "چهار تصویر تبلیغاتی با چهره‌های واقعی؛ برای بزرگ‌نمایی لمس کنید."),
                color=Color(0xFFA2B8B2),fontSize=12.sp,lineHeight=20.sp)
        }
        editorialTitles151.indices.chunked(2).forEach { row ->
            Row(
                Modifier.fillMaxWidth().padding(horizontal=18.dp),
                horizontalArrangement=Arrangement.spacedBy(12.dp)
            ) {
                row.forEach { index ->
                    Box(Modifier.weight(1f).aspectRatio(.76f)
                        .clip(RoundedCornerShape(19.dp))
                        .border(.7.dp,Color(0xFF3B5360),RoundedCornerShape(19.dp))
                        .clickable { selected=index }) {
                        EditorialImage151(photos.getOrNull(index),
                            tr(lang,editorialTitles151[index].english,
                                editorialTitles151[index].persian),
                            Modifier.fillMaxSize())
                        Box(Modifier.fillMaxWidth().height(82.dp)
                            .align(Alignment.BottomCenter).background(
                                Brush.verticalGradient(listOf(Color.Transparent,
                                    Color(0xEB03090B)))))
                        Row(Modifier.fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .padding(horizontal=10.dp,vertical=12.dp),
                            verticalAlignment=Alignment.CenterVertically) {
                            Text(tr(lang,editorialTitles151[index].english,
                                editorialTitles151[index].persian),
                                color=Color.White,fontSize=11.sp,
                                fontWeight=FontWeight.Bold,
                                modifier=Modifier.weight(1f))
                            Icon(Icons.Default.NorthEast,null,tint=emerald,
                                modifier=Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
        Text(tr(lang,
            "Reference-based promotional concepts, not photographs of official BetVima events.",
            "این تصاویر، نمونه‌های تبلیغاتی برگرفته از عکس‌های مرجع هستند و مستند رویداد رسمی بت‌ویما نیستند."),
            color=Color(0xFF88A09A),fontSize=10.sp,lineHeight=16.sp,
            modifier=Modifier.padding(horizontal=22.dp))
    }
    if(selected>=0) {
        Dialog(onDismissRequest={ selected=-1 },
            properties=DialogProperties(usePlatformDefaultWidth=false,
                decorFitsSystemWindows=false)) {
            Column(
                Modifier.fillMaxSize().background(Color(0xFF03070A))
                    .padding(top=30.dp,bottom=25.dp),
                horizontalAlignment=Alignment.CenterHorizontally
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal=20.dp),
                    verticalAlignment=Alignment.CenterVertically,
                    horizontalArrangement=Arrangement.SpaceBetween
                ) {
                    Text("BetVima",color=emerald,fontSize=19.sp,
                        fontWeight=FontWeight.Black)
                    IconButton(onClick={selected=-1}) {
                        Icon(Icons.Default.Close,
                            contentDescription=tr(lang,"Close gallery","بستن گالری"),
                            tint=Color.White)
                    }
                }
                var delta by remember { mutableFloatStateOf(0f) }
                Box(
                    Modifier.fillMaxWidth().weight(1f)
                        .padding(horizontal=20.dp,vertical=14.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .pointerInput(selected) {
                            detectHorizontalDragGestures(
                                onDragStart={delta=0f},
                                onHorizontalDrag={change, dragAmount->
                                    change.consume()
                                    delta+=dragAmount
                                },
                                onDragEnd={
                                    if(delta < -55f) {
                                        selected=(selected+1)%editorialTitles151.size
                                    } else if(delta>55f) {
                                        selected=(selected+editorialTitles151.size-1)%editorialTitles151.size
                                    }
                                    delta=0f
                                }
                            )
                        }
                ) {
                    EditorialImage151(photos.getOrNull(selected),
                        tr(lang,editorialTitles151[selected].english,
                            editorialTitles151[selected].persian),
                        Modifier.fillMaxSize())
                }
                Row(
                    Modifier.fillMaxWidth().padding(horizontal=22.dp),
                    horizontalArrangement=Arrangement.SpaceBetween,
                    verticalAlignment=Alignment.CenterVertically
                ) {
                    IconButton(onClick={
                        selected=(selected+editorialTitles151.size-1)%editorialTitles151.size
                    }) {
                        Icon(Icons.Default.ArrowBackIosNew,
                            contentDescription=tr(lang,"Previous image","تصویر قبلی"),
                            tint=Color.White)
                    }
                    Text("${selected+1} / ${editorialTitles151.size}",
                        color=Color.White,fontSize=13.sp)
                    IconButton(onClick={ selected=(selected+1)%editorialTitles151.size }) {
                        Icon(Icons.Default.ArrowForwardIos,
                            contentDescription=tr(lang,"Next image","تصویر بعدی"),
                            tint=Color.White)
                    }
                }
                LazyRow(
                    horizontalArrangement=Arrangement.spacedBy(9.dp),
                    contentPadding=PaddingValues(horizontal=18.dp)
                ) {
                    itemsIndexed(editorialTitles151) { index,photo ->
                        Box(
                            Modifier.width(75.dp).height(72.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .border(if(index==selected)2.dp else .5.dp,
                                    if(index==selected)electric else Color(0xFF4B5964),
                                    RoundedCornerShape(14.dp))
                                .clickable {selected=index}
                        ) {
                            EditorialImage151(photos.getOrNull(index),
                                tr(lang,photo.english,photo.persian),
                                Modifier.fillMaxSize())
                        }
                    }
                }
            }
        }
    }
}
