package com.betvima.app.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateDpAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.ui.graphics.graphicsLayer
import kotlin.math.abs
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest

// The visual sequence and swipeable cards follow the user's video reference.
// All assets are BetVima-neutral licensed imagery, never a third-party brand logo.
// The photos are editorial illustrations, not representations of employee identity,
// a promised gift catalogue, or an approved VIP entitlement.
private val v192Night = Color(0xFF121316)
private val v192Panel = Color(0xFF202328)
private val v192Line = Color(0xFF363A42)
private val v192Silver = Color(0xFFEBEFF3)
private val v192Mute = Color(0xFFA8B1BD)
private val v192Mint = Color(0xFF00D47A)
private val v192Text = Color(0xFFF7F8FA)

// Editorial lifestyle imagery; lazy loading with bundled local fallback.
private const val v192Jet = "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1100&q=85"
private const val v192Luggage = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=750&q=83"
private const val v192Interior = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=750&q=83"
private const val v192Car = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=750&q=83"
private const val v192BlueCar = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=750&q=83"
private const val v192Yacht = "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=750&q=83"
private const val v192Watch = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=750&q=83"
private const val v192Jewellery = "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=750&q=83"
private const val v192Man = "file:///android_asset/affiliate/people_1.webp"
private const val v192Woman = "file:///android_asset/affiliate/people_2.webp"

private data class V192Tile(
    val titleEn: String, val titleFa: String, val image: String,
    val symbol: String = ""
)
private val v192Concierge = listOf(
    V192Tile("Travel arrangements", "برنامه‌ریزی سفر", v192Luggage),
    V192Tile("Leisure organization", "برنامه‌های تفریحی", v192Car),
    V192Tile("Family assistance", "خدمات خانوادگی", v192Interior),
    V192Tile("Shopping assistance", "راهنمایی خرید", v192Watch),
    V192Tile("Health-related assistance", "راهنمایی خدمات سلامت", v192Yacht)
)
private val v192Personal = listOf(
    V192Tile("Personal bonuses", "پاداش‌های اختصاصی", v192Watch),
    V192Tile("Private experiences", "تجربه‌های اختصاصی", v192Jet),
    V192Tile("Custom interface", "رابط اختصاصی", v192Interior),
    V192Tile("Epic events", "رویدادهای ویژه", v192BlueCar),
    V192Tile("Premium travel", "سفرهای ویژه", v192Yacht)
)
private val v192Gifts = listOf(
    V192Tile("Premium cars", "خودروهای ممتاز", v192BlueCar, "VIP"),
    V192Tile("Luxury jewellery", "جواهرات لوکس", v192Jewellery, "VIP"),
    V192Tile("Luxury watches", "ساعت‌های لوکس", v192Watch, "VIP"),
    V192Tile("Yacht experiences", "تجربه قایق‌های تفریحی", v192Yacht, "VIP")
)

@Composable
private fun V192Photo(url: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var useOffline by remember(url) { mutableStateOf(false) }
    val fallback = when (url) {
        v192Man -> v192Man
        v192Woman -> v192Woman
        v192Jet, v192Yacht -> "file:///android_asset/affiliate/global_stadium.webp"
        v192Car, v192BlueCar -> "file:///android_asset/affiliate/app_showcase.webp"
        v192Watch, v192Jewellery -> "file:///android_asset/affiliate/partners.webp"
        v192Interior -> "file:///android_asset/affiliate/winning_moment.webp"
        else -> "file:///android_asset/affiliate/hero_stadium.webp"
    }
    Box(modifier.background(
        Brush.linearGradient(listOf(Color(0xFF495969), Color(0xFF252C36), v192Night))
    )) {
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(if (useOffline) fallback else url)
                .crossfade(340)
                .build(),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            onError = { if (!useOffline) useOffline = true }
        )
    }
}

@Composable
private fun V192Dots(current: Int, count: Int, light: Boolean = false) {
    Row(
        Modifier.fillMaxWidth().padding(top = 11.dp, bottom = 10.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(count) { index ->
            val width by animateDpAsState(
                targetValue = if (index == current) 20.dp else 7.dp,
                animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
                label = "vip-indicator-width"
            )
            val color by animateColorAsState(
                targetValue = if (index == current)
                    (if (light) Color(0xFF15181B) else Color.White)
                else (if (light) Color(0xFFBABFC5) else Color(0xFF676C74)),
                animationSpec = tween(230), label = "vip-indicator-color"
            )
            Box(Modifier.padding(horizontal = 3.dp)
                .width(width).height(3.dp).clip(CircleShape).background(color))
        }
    }
}

/**
 * Keeps each section's measured height intact while its contents fade and
 * translate into view. No zero-height AnimatedVisibility items (which would
 * otherwise make LazyColumn jump during the first layout).
 */
@Composable
private fun V192Reveal(index: Int, scroll: LazyListState, content: @Composable () -> Unit) {
    val inViewport by remember(scroll, index) {
        derivedStateOf { scroll.layoutInfo.visibleItemsInfo.any { it.index == index } }
    }
    var appeared by rememberSaveable(index) { mutableStateOf(false) }
    LaunchedEffect(inViewport) { if (inViewport) appeared = true }
    val alpha by animateFloatAsState(
        if (appeared) 1f else .60f,
        animationSpec = tween(570, easing = FastOutSlowInEasing),
        label = "vip-section-alpha"
    )
    val y by animateFloatAsState(
        if (appeared) 0f else 32f,
        animationSpec = tween(620, easing = FastOutSlowInEasing),
        label = "vip-section-translate"
    )
    Box(Modifier.fillMaxWidth().graphicsLayer {
        this.alpha = alpha
        this.translationY = y
    }) { content() }
}

private fun v192SwipeDistance(index: Int, listState: LazyListState): Float {
    val info = listState.layoutInfo
    val item = info.visibleItemsInfo.firstOrNull { it.index == index } ?: return 1f
    val viewport = ((info.viewportStartOffset + info.viewportEndOffset) / 2f)
    val itemCentre = item.offset + item.size / 2f
    val halfView = ((info.viewportEndOffset - info.viewportStartOffset) / 2f).coerceAtLeast(1f)
    return (abs(itemCentre - viewport) / halfView).coerceIn(0f, 1f)
}

@Composable
private fun V192Hero(lang: Lang, scroll: LazyListState) {
    val parallax = if (scroll.firstVisibleItemIndex == 0)
        scroll.firstVisibleItemScrollOffset * .14f else 0f
    Box(Modifier.fillMaxWidth().height(396.dp)) {
        V192Photo(v192Jet, Modifier.fillMaxSize().graphicsLayer {
            translationY = parallax
        })
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(
            Color(0xC8111419), Color(0x38111419), Color(0x50232935), v192Night
        ))))
        Column(Modifier.align(Alignment.TopStart)
            .padding(start=17.dp, top=22.dp, end=12.dp)) {
            Text(tr(lang, "VIP Club", "باشگاه VIP"),
                color=Color.White, fontSize=38.sp, lineHeight=43.sp,
                fontWeight=FontWeight.Black)
            Spacer(Modifier.height(8.dp))
            Text(tr(lang, "What makes the BetVima\nVIP CLUB the best choice?",
                "چه چیزی باشگاه VIP بت‌ویما را\nبه انتخابی ویژه تبدیل می‌کند؟"),
                color=Color.White, fontSize=12.sp, lineHeight=17.sp,
                fontWeight=FontWeight.Medium)
        }
        Row(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Color.Transparent,
                    v192Night.copy(alpha=.64f))))
                .padding(start=10.dp,end=10.dp,bottom=26.dp,top=14.dp),
            horizontalArrangement=Arrangement.spacedBy(4.dp)
        ) {
            listOf(
                tr(lang, "PREMIUM\nEXPERIENCES", "تجربه‌های\nممتاز"),
                tr(lang, "VIP\nACCESS", "دسترسی\nVIP"),
                tr(lang, "BETVIMA\nREWARDS", "پاداش‌های\nبت‌ویما")
            ).forEach { label ->
                Row(Modifier.weight(1f), horizontalArrangement=Arrangement.Center,
                    verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.EmojiEvents, null, tint=Color(0xFFE1D1A4),
                        modifier=Modifier.size(20.dp))
                    Spacer(Modifier.width(3.dp))
                    Text(label, color=Color.White,fontSize=8.sp,
                        fontWeight=FontWeight.Black,lineHeight=10.sp,maxLines=2)
                }
            }
        }
    }
}

@Composable
private fun V192Manager(lang: Lang) {
    Box(Modifier.fillMaxWidth().height(300.dp)
        .background(Brush.verticalGradient(listOf(Color(0xFF303C49),v192Night)))) {
        Row(Modifier.fillMaxWidth().height(252.dp).align(Alignment.BottomCenter)) {
            Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(topStart=12.dp))) {
                V192Photo(v192Woman, Modifier.fillMaxSize())
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
                    listOf(Color(0xFF1D2531).copy(alpha=.65f),Color.Transparent,
                        v192Night.copy(alpha=.45f)))))
            }
            Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(topEnd=12.dp))) {
                V192Photo(v192Man, Modifier.fillMaxSize())
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
                    listOf(Color(0xFF1D2531).copy(alpha=.65f),Color.Transparent,
                        v192Night.copy(alpha=.45f)))))
            }
        }
        Column(Modifier.align(Alignment.TopStart).padding(start=16.dp,top=20.dp)) {
            Text(tr(lang,"VIP manager","مدیر VIP"), color=Color.White,
                fontSize=23.sp,fontWeight=FontWeight.Black)
            Spacer(Modifier.height(4.dp))
            Text(tr(lang,"Helps with any questions\nand is always available",
                "راهنمای پرسش‌ها و\nمزایای احتمالی اعضا"),
                color=v192Mute,fontSize=12.sp,lineHeight=16.sp)
        }
        val infinite = rememberInfiniteTransition(label="vip-manager-live")
        val pulse by infinite.animateFloat(
            initialValue=.40f,targetValue=1f,
            animationSpec=infiniteRepeatable(tween(1150),RepeatMode.Reverse),
            label="vip-manager-pulse"
        )
        Row(Modifier.align(Alignment.TopEnd).padding(13.dp)
            .background(Color(0x88454C57),RoundedCornerShape(12.dp))
            .padding(horizontal=10.dp,vertical=6.dp),
            verticalAlignment=Alignment.CenterVertically) {
            Text(tr(lang, "24/7", "۲۴/۷"),color=Color.White,
                fontWeight=FontWeight.Bold,fontSize=11.sp)
            Spacer(Modifier.width(4.dp))
            Box(Modifier.size(7.dp).clip(CircleShape)
                .background(v192Mint.copy(alpha=pulse)))
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun V192ImageSlider(
    lang: Lang, title: String, subtitle: String, tiles: List<V192Tile>,
    light: Boolean, tall: Boolean = false
) {
    val listState = rememberLazyListState()
    val current by remember(listState) {
        derivedStateOf { listState.firstVisibleItemIndex.coerceIn(0,tiles.lastIndex) }
    }
    val shape = if (light) RoundedCornerShape(23.dp) else RoundedCornerShape(0.dp)
    val background = if (light) Color(0xFFF6F7F8) else v192Night
    Column(Modifier.fillMaxWidth().clip(shape).background(background)
        .padding(top=if(light) 16.dp else 25.dp, bottom=6.dp)) {
        Column(Modifier.padding(horizontal=15.dp)) {
            Text(title,color=if(light)Color(0xFF171A1E) else v192Text,
                fontSize=22.sp,fontWeight=FontWeight.Bold)
            if(subtitle.isNotBlank()) {
                Text(subtitle,color=if(light)Color(0xFF656A72) else v192Mute,
                    fontSize=11.sp,lineHeight=15.sp)
            }
        }
        Spacer(Modifier.height(14.dp))
        LazyRow(
            modifier=Modifier.fillMaxWidth(),
            state=listState,
            contentPadding=PaddingValues(horizontal=11.dp),
            horizontalArrangement=Arrangement.spacedBy(9.dp),
            flingBehavior=rememberSnapFlingBehavior(lazyListState=listState)
        ) {
            itemsIndexed(tiles) { index,tile ->
                val distance = v192SwipeDistance(index,listState)
                Box(Modifier
                    .width(if(tall) 231.dp else 151.dp)
                    .height(if(tall) 276.dp else 195.dp)
                    .graphicsLayer {
                        val zoom=1f-distance*.085f
                        scaleX=zoom;scaleY=zoom
                        translationY=distance*10.dp.toPx()
                        alpha=1f-distance*.13f
                    }
                    .clip(RoundedCornerShape(15.dp))
                    .background(Color(0xFF3C4651))) {
                    V192Photo(tile.image,Modifier.fillMaxSize())
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
                        listOf(Color(0x99101922),Color.Transparent,Color(0x22111519)))))
                    Column(Modifier.align(Alignment.TopStart).padding(11.dp)) {
                        if(tile.symbol.isNotBlank()) {
                            Text(tile.symbol,color=Color.White.copy(alpha=.94f),
                                fontSize=36.sp,fontWeight=FontWeight.Black)
                        }
                        Text(tr(lang,tile.titleEn,tile.titleFa),color=Color.White,
                            fontSize=12.sp,lineHeight=15.sp,fontWeight=FontWeight.Black,
                            maxLines=3,overflow=TextOverflow.Ellipsis)
                    }
                }
            }
        }
        V192Dots(current,tiles.size,light)
    }
}

/**
 * The white concierge surface overlaps the preceding manager portraits.
 * Each slider captures horizontal swipes; the surrounding LazyColumn
 * independently handles vertical gestures.
 */
@Composable
private fun V192ManagerConcierge(lang: Lang) {
    Box(Modifier.fillMaxWidth().height(566.dp)) {
        V192Manager(lang)
        Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
            V192ImageSlider(
                lang,tr(lang,"Concierge service","خدمات Concierge"),
                tr(lang,"Enjoy the comfort while we take care of the rest",
                    "آسودگی بیشتر با خدمات ویژه، در صورت ارائه"),
                v192Concierge,light=true)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun V192Numbers(lang: Lang) {
    val cards = listOf(
        Triple("05", tr(lang,"weekly cashback tiers","سطح کش‌بک هفتگی"),
            tr(lang,"Published BetVima VIP plan comparisons",
                "مقایسه پلن‌های اعلام‌شده VIP بت‌ویما")),
        Triple("3–11%",tr(lang,"eligible-loss cashback rates",
            "نرخ کش‌بک باخت واجد شرایط"),
            tr(lang,"Rates depend on approved weekly deposit tiers",
                "نرخ بر اساس سطح واریز هفتگی تعیین می‌شود")),
        Triple("$2k+",tr(lang,"weekly deposits to enter the first plan",
            "شروع نخستین سطح واریز هفتگی"),
            tr(lang,"Personal cashback remains subject to verification",
                "کش‌بک واقعی تابع تأیید حساب است"))
    )
    val slideState=rememberLazyListState()
    val current by remember(slideState) {
        derivedStateOf { slideState.firstVisibleItemIndex.coerceIn(0,cards.lastIndex) }
    }
    Column(Modifier.fillMaxWidth().background(v192Night)
        .padding(top=24.dp,bottom=4.dp)) {
        Text(tr(lang,"VIP Club by the numbers","باشگاه VIP در یک نگاه"),
            modifier=Modifier.padding(horizontal=14.dp),
            color=v192Text,fontSize=22.sp,fontWeight=FontWeight.Bold)
        Spacer(Modifier.height(15.dp))
        LazyRow(
            state=slideState,
            modifier=Modifier.fillMaxWidth(),
            contentPadding=PaddingValues(horizontal=11.dp),
            horizontalArrangement=Arrangement.spacedBy(12.dp),
            flingBehavior=rememberSnapFlingBehavior(lazyListState=slideState)
        ) {
            itemsIndexed(cards) { index,card ->
                val distance=v192SwipeDistance(index,slideState)
                Box(Modifier.fillParentMaxWidth(.92f).height(298.dp)
                    .graphicsLayer {
                        scaleX=1f-distance*.045f
                        scaleY=1f-distance*.08f
                        translationY=distance*11.dp.toPx()
                        alpha=1f-distance*.18f
                    }
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(
                        Color.White,Color(0xFFE5E8EC),Color(0xFFF8F9FB)
                    )))) {
                    Column(Modifier.fillMaxSize().padding(horizontal=18.dp,vertical=25.dp),
                        horizontalAlignment=Alignment.CenterHorizontally,
                        verticalArrangement=Arrangement.SpaceBetween) {
                        Text(card.third,color=Color(0xFF666D77),fontSize=11.sp,lineHeight=15.sp)
                        Text(card.first,color=Color(0xFF222932),fontSize=70.sp,
                            lineHeight=76.sp,fontWeight=FontWeight.Black,maxLines=1)
                        Text(card.second,color=Color(0xFF393E46),fontSize=14.sp,
                            lineHeight=18.sp,fontWeight=FontWeight.Bold)
                        HorizontalDivider(color=Color(0xFFCFD4DA))
                        Text("BETVIMA VIP",color=Color(0xFF7E8792),fontSize=10.sp,
                            fontWeight=FontWeight.ExtraBold)
                    }
                }
            }
        }
        V192Dots(current,cards.size,light=false)
    }
}

@Composable
private fun V192Access(lang: Lang, onPlans: () -> Unit, onSupport: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp)) {
        Text(tr(lang, "Choose how to get access\nto the VIP Club",
            "راه‌های دسترسی به\nباشگاه VIP"),
            color = v192Text, fontSize = 22.sp, lineHeight = 26.sp,
            fontWeight = FontWeight.Bold)
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(
                Color(0xFF242C3A), Color(0xFF425266), Color(0xFF273346)
            ))).padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(tr(lang, "Migrate your VIP status", "انتقال سطح VIP"),
                color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(tr(lang,
                "Ask support whether status from another platform can be reviewed for BetVima.",
                "از پشتیبانی بپرسید آیا سطح VIP پلتفرم دیگر برای بت‌ویما قابل بررسی است."),
                color = Color(0xFFD3DBE6), fontSize = 11.sp, lineHeight = 16.sp)
            Button(onClick = onSupport,
                shape = RoundedCornerShape(11.dp),
                colors=ButtonDefaults.buttonColors(containerColor=Color.White)) {
                Text(tr(lang, "Ask support", "پرسش از پشتیبانی"),
                    color = Color(0xFF252A30), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(
                Color(0xFF425166), Color(0xFF8E9DAE), Color(0xFF38495E)
            ))).padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(tr(lang, "Advance through levels", "ارتقا در سطوح VIP"),
                color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(tr(lang, "Explore the five published weekly cashback bands.",
                "پنج سطح منتشرشده کش‌بک هفتگی بت‌ویما را بررسی کنید."),
                color = Color.White, fontSize = 11.sp)
            Button(onClick = onPlans,
                shape = RoundedCornerShape(11.dp),
                colors=ButtonDefaults.buttonColors(containerColor=Color.White)) {
                Text(tr(lang, "Learn more", "اطلاعات بیشتر"),
                    color = Color(0xFF252A30), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private data class V192Faq(val en: String, val fa: String, val answerEn: String, val answerFa: String)
private val v192Faq = listOf(
    V192Faq("How do I get VIP status?", "چطور VIP می‌شوم؟",
        "Review the published BetVima weekly cashback plans. Personal tier eligibility must be confirmed on the server.",
        "پلن‌های کش‌بک هفتگی را بررسی کنید. سطح واقعی هر حساب باید توسط سرور تأیید شود."),
    V192Faq("Can I keep my status from another platform when switching to BetVima?",
        "آیا می‌توان سطح VIP پلتفرم قبلی را منتقل کرد؟",
        "Contact support to ask about any possible status review. Transfer is not automatic or guaranteed.",
        "برای بررسی امکان انتقال به پشتیبانی پیام دهید؛ انتقال خودکار یا تضمینی نیست."),
    V192Faq("Why do I need a personal VIP manager, and how are they different from support?",
        "مدیر VIP چه تفاوتی با پشتیبانی دارد؟",
        "A dedicated manager would provide tailored guidance where this service is available. Contact support for current eligibility.",
        "مدیر اختصاصی در صورت ارائه این خدمت، راهنمایی ویژه ارائه می‌کند. درباره فعال بودن آن با پشتیبانی هماهنگ کنید."),
    V192Faq("What is the concierge service?", "خدمات Concierge چیست؟",
        "The examples above illustrate premium assistance. Availability and terms must be confirmed by BetVima.",
        "نمونه‌های بالا فقط ایده‌های خدمات ویژه هستند. ارائه و شرایط آنها باید توسط بت‌ویما تأیید شود.")
)

@Composable
private fun V192FaqSection(lang: Lang) {
    var expanded by rememberSaveable { mutableIntStateOf(-1) }
    Column(Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(tr(lang, "FAQ", "پرسش‌های متداول"),
            color = v192Text, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        v192Faq.forEachIndexed { i, q ->
            Column(Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF232528))
                .clickable { expanded = if (expanded == i) -1 else i }
                .animateContentSize()
                .padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(tr(lang, q.en, q.fa), modifier = Modifier.weight(1f),
                        color = v192Text, fontSize = 12.sp, lineHeight = 17.sp,
                        fontWeight = FontWeight.Medium)
                    Icon(if (expanded == i) Icons.Default.KeyboardArrowUp
                        else Icons.Default.KeyboardArrowDown, null,
                        tint = v192Mute, modifier = Modifier.size(18.dp))
                }
                if (expanded == i) {
                    Spacer(Modifier.height(9.dp))
                    Text(tr(lang, q.answerEn, q.answerFa),
                        color = v192Mute, fontSize = 11.sp, lineHeight = 18.sp)
                }
            }
        }
    }
}

@Composable
private fun V192Footer(lang: Lang, onSupport: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(13.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("BET", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Text("VIMA", color = v192Mint, fontSize = 20.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            Text("VIP", color=v192Silver, fontSize=13.sp, fontWeight=FontWeight.Black)
        }
        HorizontalDivider(color=v192Line)
        Text(tr(lang, "Information", "اطلاعات"),
            color=v192Text, fontSize=12.sp, fontWeight=FontWeight.Bold)
        Text(tr(lang, "Categories", "دسته‌بندی‌ها"),
            color=v192Text, fontSize=12.sp, fontWeight=FontWeight.Bold)
        Surface(onClick=onSupport, shape=RoundedCornerShape(13.dp),
            color = v192Panel, border=BorderStroke(1.dp,v192Line)) {
            Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.SupportAgent, null, tint = v192Mint)
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(tr(lang, "Support", "پشتیبانی"), color=v192Text, fontSize=13.sp)
                    Text(tr(lang, "Ask about VIP services and account eligibility",
                        "پرسش درباره خدمات و شرایط حساب VIP"),
                        color=v192Mute, fontSize=10.sp)
                }
            }
        }
        Text(tr(lang,
            "VIP pictures are editorial examples, not confirmed BetVima gifts or services. The published cashback plans remain subject to server verification. Photography via Unsplash.",
            "تصاویر VIP نمونه‌های تبلیغاتی هستند و به معنی اعطای هدیه یا تضمین خدمت از سوی بت‌ویما نیستند. پلن‌های کش‌بک تابع تأیید سرور هستند. تصاویر از Unsplash."),
            color=v192Mute, fontSize=10.sp, lineHeight=15.sp)
    }
}

@Composable
internal fun VipReference192Screen(
    state: AppState,
    model: AppViewModel,
    onViewPlans: () -> Unit,
    onSupport: () -> Unit
) {
    val lang=state.lang
    // The VIP modal and its chrome never scroll. Only the body owns vertical
    // scrolling; every carousel has a separate horizontal LazyListState.
    val verticalScroll=rememberLazyListState()
    Box(Modifier.fillMaxSize().background(v192Night)) {
        LazyColumn(
            state=verticalScroll,
            modifier=Modifier.fillMaxSize(),
            contentPadding=PaddingValues(bottom=85.dp),
            flingBehavior=rememberPremiumFlingBehavior()
        ) {
            item(key="vip-hero") {
                V192Reveal(0,verticalScroll) { V192Hero(lang,verticalScroll) }
            }
            item(key="vip-connected-manager-concierge") {
                V192Reveal(1,verticalScroll) { V192ManagerConcierge(lang) }
            }
            item(key="vip-personal-swiper") {
                V192Reveal(2,verticalScroll) {
                    V192ImageSlider(
                        lang,tr(lang,"A personal approach","رویکرد اختصاصی"),
                        tr(lang,"Illustrative premium experiences","نمونه‌های تصویری تجربیات ممتاز"),
                        v192Personal,light=false)
                }
            }
            item(key="vip-gift-swiper") {
                V192Reveal(3,verticalScroll) {
                    V192ImageSlider(
                        lang,tr(lang,"Exclusive gifts","هدایای ویژه"),
                        tr(lang,"Illustrative catalogue, subject to availability",
                            "تصاویر نمونه هستند و ارائه هدایا تابع شرایط است"),
                        v192Gifts,light=false,tall=true)
                }
            }
            item(key="vip-numbers") {
                V192Reveal(4,verticalScroll) { V192Numbers(lang) }
            }
            item(key="vip-access") {
                V192Reveal(5,verticalScroll) {
                    V192Access(lang,onViewPlans,onSupport)
                }
            }
            item(key="vip-questions") {
                V192Reveal(6,verticalScroll) { V192FaqSection(lang) }
            }
            item(key="vip-footer") {
                V192Reveal(7,verticalScroll) { V192Footer(lang,onSupport) }
            }
        }
        Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth()
            .background(Brush.verticalGradient(listOf(
                Color.Transparent, v192Night.copy(alpha=.98f),v192Night
            ))).padding(horizontal=10.dp,vertical=11.dp)) {
            Button(
                onClick=onSupport,
                modifier=Modifier.fillMaxWidth().height(46.dp),
                shape=RoundedCornerShape(9.dp),
                colors=ButtonDefaults.buttonColors(containerColor=Color.White)
            ) {
                Text(tr(lang,"Migrate your VIP status","بررسی انتقال سطح VIP"),
                    color=Color(0xFF17191B),fontSize=12.sp,fontWeight=FontWeight.Black)
            }
        }
    }
}
